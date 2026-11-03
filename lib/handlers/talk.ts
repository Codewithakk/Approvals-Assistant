import type { ApprovalQueue } from "@/schemas/approval";
import type { AiResponse } from "@/schemas/ai";
import { TalkResponseSchema } from "@/schemas/ai";
import { callClaudeJson } from "@/lib/llm";
import { buildFallback } from "@/lib/fallback";
import { talkSystemPrompt, talkUserPrompt } from "@/prompts/talk.v1";
import type { ChatTurn } from "@/schemas/ai";

export async function handleTalk(
    queue: ApprovalQueue,
    history: ChatTurn[],
    message: string
): Promise<AiResponse> {
    const outcome = await callClaudeJson(
        TalkResponseSchema,
        talkSystemPrompt,
        talkUserPrompt(queue, history, message)
    );
    return outcome.ok ? outcome.data : buildFallback("talk", outcome.reason, queue);
}