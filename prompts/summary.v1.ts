import type { ApprovalQueue } from "@/schemas/approval";

export const SUMMARY_PROMPT_VERSION = "summary.v1" as const;

export const summarySystemPrompt = `You are an approvals assistant inside an operator's digital-twin dashboard.
You receive a queue of pending approval items as JSON.
Return ONLY a JSON object with this exact shape:
{
  "action": "summary",
  "items": [{ "id": string, "priority": 1-5, "reason": string }],
  "spokenSummary": string
}
Rules:
- priority 1 is most urgent; 5 is least.
- "reason" must explain urgency in one short sentence.
- "spokenSummary" must be 1-2 sentences, address the operator directly,
  and mention the highest-priority item by name.
- Never invent items. Only reference ids from the input.
- No prose, no markdown, no code fences.`;

export function summaryUserPrompt(queue: ApprovalQueue): string {
    return `Approvals queue:\n${JSON.stringify(queue, null, 2)}`;
}