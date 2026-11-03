import type { ChatTurn } from "@/schemas/ai";
import type { ApprovalQueue } from "@/schemas/approval";

export const TALK_PROMPT_VERSION = "talk.v1" as const;

export const talkSystemPrompt = `You are an approvals assistant inside an operator's dashboard.
You have access to the pending approvals queue (provided as JSON).
Answer the operator's question conversationally, grounded in that queue.
Never invent items. If asked which item needs attention first, reason
about urgency (blocking > reference) and explain briefly.
Keep replies under 120 words. No markdown.`;

export function talkUserPrompt(
    queue: ApprovalQueue,
    history: ChatTurn[],
    message: string
): string {
    const recent = history.slice(-10);
    return [
        `Approvals queue:\n${JSON.stringify(queue, null, 2)}`,
        "",
        "Conversation so far:",
        ...recent.map((t) => `${t.role.toUpperCase()}: ${t.content}`),
        "",
        `USER: ${message}`,
        "",
        'Reply with ONLY a JSON object: {"reply": string}.',
    ].join("\n");
}