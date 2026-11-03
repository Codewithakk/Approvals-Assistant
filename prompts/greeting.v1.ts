import type { ApprovalQueue } from "@/schemas/approval";

export const GREETING_PROMPT_VERSION = "greeting.v1" as const;

export const greetingSystemPrompt = `You write ONE short, context-aware greeting for
an operator entering the approvals panel. Reference the current pending count
and any obviously urgent item by name. Under 25 words. No emojis.
Return ONLY JSON: {"greeting": string}.`;

export function greetingUserPrompt(queue: ApprovalQueue): string {
    return `Queue:\n${JSON.stringify(queue, null, 2)}\n\nReturn JSON only.`;
}