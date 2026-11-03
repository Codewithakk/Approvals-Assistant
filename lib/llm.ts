import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import type { FallbackReason } from "./fallback";

// const TIMEOUT_MS = 50; 
const TIMEOUT_MS = 8_000;

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export type LlmOutcome<T> =
    | { ok: true; data: T }
    | { ok: false; reason: FallbackReason };

export async function callClaudeJson<T>(
    schema: ZodType<T>,
    systemPrompt: string,
    userPrompt: string
): Promise<LlmOutcome<T>> {
    const key = process.env.ANTHROPIC_API_KEY;
    console.log(
        "[llm] env key present:",
        !!key,
        "len:",
        key?.length ?? 0,
        "prefix:",
        key ? key.slice(0, 10) + "..." : "(none)"
    );
    /* -------------------------------------------------------------------- */

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await client.messages.create(
            {
                model: "claude-sonnet-4-5",
                max_tokens: 1024,
                // temperature: 0.2,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }],
            },
            { signal: controller.signal }
        );

        const text = response.content
            .filter((block): block is Anthropic.TextBlock => block.type === "text")
            .map((block) => block.text)
            .join("");

        console.log("[llm] raw response length:", text.length);
        console.log("[llm] raw response head:", text.slice(0, 400));

        const json = extractJson(text);
        if (json === null) {
            console.error("[llm] extractJson returned null — model did not emit JSON");
            return { ok: false, reason: "invalid_shape" };
        }

        const parsed = schema.safeParse(json);
        if (!parsed.success) {
            console.error("[llm] zod rejected:", parsed.error.issues);
            console.error("[llm] json that failed:", JSON.stringify(json).slice(0, 800));
            return { ok: false, reason: "invalid_shape" };
        }

        return { ok: true, data: parsed.data };
    } catch (err) {
        /* Full error — the line you were missing. */
        console.error("[llm] FULL ERROR:", err);
        if (isAbortError(err)) return { ok: false, reason: "timeout" };
        return { ok: false, reason: "upstream_error" };
    } finally {
        clearTimeout(timer);
    }
}

function isAbortError(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        "name" in err &&
        (err as { name: string }).name === "AbortError"
    );
}

function extractJson(text: string): unknown {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : text;

    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    try {
        return JSON.parse(candidate.slice(start, end + 1));
    } catch {
        return null;
    }
}