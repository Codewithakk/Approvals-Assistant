import type { ApprovalQueue } from "@/schemas/approval";
import type { AiResponse } from "@/schemas/ai";
import { HelpResponseSchema } from "@/schemas/ai";
import { callClaudeJson } from "@/lib/llm";
import { buildFallback } from "@/lib/fallback";
import { retrieveTopK } from "@/lib/retrieval";
import { helpSystemPrompt, helpUserPrompt } from "@/prompts/help.v1";

export async function handleHelp(
    queue: ApprovalQueue,
    question: string
): Promise<AiResponse> {
    const chunks = retrieveTopK(question, 2);

    if (chunks.length === 0) {
        return buildFallback("help", "invalid_shape", queue);
    }

    const outcome = await callClaudeJson(
        HelpResponseSchema,
        helpSystemPrompt,
        helpUserPrompt(question, chunks)
    );

    if (outcome.ok) {
        const validCitations = outcome.data.citations.every((id) =>
            chunks.some((c) => c.id === id)
        );
        if (!validCitations) return buildFallback("help", "invalid_shape", queue);
    }

    return outcome.ok ? outcome.data : buildFallback("help", outcome.reason, queue);
}