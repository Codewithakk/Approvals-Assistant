import type { ApprovalQueue } from "@/schemas/approval";
import type { AiResponse } from "@/schemas/ai";
import { TeachResponseSchema } from "@/schemas/ai";
import { callClaudeJson } from "@/lib/llm";
import { buildFallback } from "@/lib/fallback";
import { teachSystemPrompt, teachUserPrompt } from "@/prompts/teach.v1";

export async function handleTeach(
    queue: ApprovalQueue,
    step: number,
    followUp?: string
): Promise<AiResponse> {
    const outcome = await callClaudeJson(
        TeachResponseSchema,
        teachSystemPrompt,
        teachUserPrompt(step, followUp)
    );
    return outcome.ok ? outcome.data : buildFallback("teach", outcome.reason, queue);
}