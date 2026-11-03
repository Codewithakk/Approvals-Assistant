import type {
    AiAction,
    FallbackResponse,
} from "@/schemas/ai";
import type { ApprovalQueue } from "@/schemas/approval";

export type FallbackReason = FallbackResponse["reason"];

export function buildFallback(
    action: AiAction,
    reason: FallbackReason,
    queue: ApprovalQueue
): FallbackResponse {
    const count = queue.length;
    const noun = count === 1 ? "item" : "items";

    const baseMessage = (() => {
        switch (action) {
            case "summary":
                return `You have ${count} ${noun} pending review. AI summary is unavailable right now — open the queue to triage manually.`;
            case "talk":
                return `Chat is temporarily unavailable. ${count} ${noun} still pending — use the queue panel to review them.`;
            case "help":
                return `Help is temporarily unavailable. You can still review approvals from the queue.`;
            case "teach":
                return `Guided walkthrough is temporarily unavailable. Open any approval to review it step by step.`;
            case "greeting":
                return count > 0
                    ? `Welcome back — ${count} ${noun} waiting for your review.`
                    : `Welcome back. Your queue is clear.`;
        }
    })();

    return {
        fallback: true,
        action,
        reason,
        message: baseMessage,
    };
}