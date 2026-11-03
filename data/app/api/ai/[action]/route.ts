import { NextRequest, NextResponse } from "next/server";
import type { AiAction, AiResponse } from "@/schemas/ai";
import {
    TalkRequestSchema,
    HelpRequestSchema,
    TeachRequestSchema,
} from "@/schemas/ai";
import { ApprovalQueueSchema } from "@/schemas/approval";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleSummary } from "@/lib/handlers/summary";
import { handleTalk } from "@/lib/handlers/talk";
import { handleHelp } from "@/lib/handlers/help";
import { handleTeach } from "@/lib/handlers/teach";
import { handleGreeting } from "@/lib/handlers/greeting";
import { buildFallback } from "@/lib/fallback";

/* eslint-disable @typescript-eslint/no-var-requires */
const queueFixture = require("@/data/approvals.json") as unknown[];
const queue = ApprovalQueueSchema.parse(queueFixture);

const VALID_ACTIONS: readonly AiAction[] = [
    "summary",
    "talk",
    "help",
    "teach",
    "greeting",
] as const;

function sseChunk(event: string, data: unknown): Uint8Array {
    return new TextEncoder().encode(
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    );
}

async function dispatch(
    action: AiAction,
    body: Record<string, unknown>
): Promise<AiResponse> {
    switch (action) {
        case "summary":
            return handleSummary(queue);

        case "greeting":
            return handleGreeting(queue);

        case "talk": {
            const parsed = TalkRequestSchema.safeParse(body);
            if (!parsed.success) {
                return buildFallback("talk", "invalid_shape", queue);
            }
            return handleTalk(queue, parsed.data.history, parsed.data.message);
        }

        case "help": {
            const parsed = HelpRequestSchema.safeParse(body);
            if (!parsed.success) {
                return buildFallback("help", "invalid_shape", queue);
            }
            return handleHelp(queue, parsed.data.question);
        }

        case "teach": {
            const parsed = TeachRequestSchema.safeParse(body);
            if (!parsed.success) {
                return buildFallback("teach", "invalid_shape", queue);
            }
            return handleTeach(queue, parsed.data.step ?? 1, parsed.data.followUp);
        }
    }
}

export async function POST(req: NextRequest): Promise<Response> {
    const action = req.nextUrl.pathname.split("/").pop() as AiAction;

    /* §3: bad action → 400, not 500. */
    if (!VALID_ACTIONS.includes(action)) {
        return NextResponse.json(
            { error: "unknown_action", action },
            { status: 400 }
        );
    }

    /* §3: per-session throttle. Session id from cookie or IP. */
    const sessionId =
        req.cookies.get("sid")?.value ??
        req.headers.get("x-forwarded-for")?.split(",")[0] ??
        "anon";

    const rl = checkRateLimit(sessionId);
    if (!rl.ok) {
        return NextResponse.json(
            { error: "rate_limited", retryAfterSec: rl.retryAfterSec },
            { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
        );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                const result = await dispatch(action, body);

                const json = JSON.stringify(result);
                const CHUNK = 24;
                for (let i = 0; i < json.length; i += CHUNK) {
                    controller.enqueue(
                        sseChunk("token", { delta: json.slice(i, i + CHUNK) })
                    );
                    await new Promise((r) => setTimeout(r, 0));
                }

                controller.enqueue(sseChunk("done", result));
                controller.close();
            } catch {

                controller.enqueue(
                    sseChunk("done", buildFallback(action, "upstream_error", queue))
                );
                controller.close();
            }
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
        },
    });
}