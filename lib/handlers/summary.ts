import type { ApprovalQueue } from "@/schemas/approval";
import type { AiResponse, SummaryResponse } from "@/schemas/ai";
import { SummaryResponseSchema } from "@/schemas/ai";
import { callClaudeJson } from "@/lib/llm";
import { buildFallback } from "@/lib/fallback";
import {
    summarySystemPrompt,
    summaryUserPrompt,
} from "@/prompts/summary.v1";

export async function handleSummary(
    queue: ApprovalQueue
): Promise<AiResponse> {
    const outcome = await callClaudeJson(
        SummaryResponseSchema,
        summarySystemPrompt,
        summaryUserPrompt(queue)
    );

    if (!outcome.ok) {
        return buildFallback("summary", outcome.reason, queue);
    }

    return outcome.data;
}