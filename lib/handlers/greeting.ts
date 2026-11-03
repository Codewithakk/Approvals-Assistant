import type { ApprovalQueue } from "@/schemas/approval";
import type { AiResponse } from "@/schemas/ai";
import { GreetingResponseSchema } from "@/schemas/ai";
import { callClaudeJson } from "@/lib/llm";
import { buildFallback } from "@/lib/fallback";
import { greetingSystemPrompt, greetingUserPrompt } from "@/prompts/greeting.v1";

export async function handleGreeting(
    queue: ApprovalQueue
): Promise<AiResponse> {
    const outcome = await callClaudeJson(
        GreetingResponseSchema,
        greetingSystemPrompt,
        greetingUserPrompt(queue)
    );
    return outcome.ok ? outcome.data : buildFallback("greeting", outcome.reason, queue);
}