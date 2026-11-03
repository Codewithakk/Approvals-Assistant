import { describe, it, expect, jest, beforeEach } from "@jest/globals";
var mockCreate: any;

jest.mock("@anthropic-ai/sdk", () => {
    return {
        __esModule: true,
        default: class MockAnthropic {
            messages = { create: (...args: unknown[]) => mockCreate(...args) };
            constructor(_opts: unknown) { }
        },
    };
});

import { handleSummary } from "@/lib/handlers/summary";
import { SummaryResponseSchema, isFallbackResponse } from "@/schemas/ai";
import { ApprovalQueueSchema } from "@/schemas/approval";
import queueFixture from "@/data/approvals.json";

const queue = ApprovalQueueSchema.parse(queueFixture);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function mockClaudeReturns(json: unknown) {
    mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(json) }],
    });
}

beforeEach(() => {
    mockCreate = jest.fn();
});

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("handleSummary — happy path", () => {
    it("parses a valid model JSON response into a typed SummaryResponse", async () => {
        mockClaudeReturns({
            action: "summary",
            items: [
                { id: "1", priority: 1, reason: "Onboarding folder blocks new patrols" },
                { id: "3", priority: 3, reason: "PDF spec is reference-only" },
            ],
            spokenSummary:
                "Two items pending. The onboarding folder is most urgent because it blocks patrol setup.",
        });

        const result = await handleSummary(queue);

        expect(isFallbackResponse(result)).toBe(false);

        const parsed = SummaryResponseSchema.safeParse(result);
        expect(parsed.success).toBe(true);

        if (parsed.success) {
            expect(parsed.data.action).toBe("summary");
            expect(parsed.data.items[0].priority).toBe(1);
            expect(parsed.data.spokenSummary).toMatch(/urgent/i);
        }

        expect(mockCreate).toHaveBeenCalledTimes(1);
        const callArg = mockCreate.mock.calls[0][0] as { messages: { content: string }[] };
        expect(callArg.messages[0].content).toContain("Site Patrol Onboarding");
    });
});

describe("handleSummary — invalid model shape", () => {
    it("returns a typed fallback (NOT throws) when priority is missing", async () => {
        mockClaudeReturns({
            action: "summary",
            items: [{ id: "1", reason: "no priority field" }],
            spokenSummary: "One item.",
        });

        const result = await handleSummary(queue);

        expect(isFallbackResponse(result)).toBe(true);
        if (isFallbackResponse(result)) {
            expect(result.reason).toBe("invalid_shape");
            expect(result.action).toBe("summary");
            expect(result.message).toMatch(/4/);
        }
    });

    it("returns a typed fallback when model returns non-JSON prose", async () => {
        mockCreate.mockResolvedValueOnce({
            content: [{ type: "text", text: "Sure! Here is your summary: ..." }],
        });

        const result = await handleSummary(queue);

        expect(isFallbackResponse(result)).toBe(true);
        if (isFallbackResponse(result)) {
            expect(result.reason).toBe("invalid_shape");
        }
    });
});

describe("handleSummary — error paths", () => {
    it("returns a timeout fallback when the SDK rejects with an abort error", async () => {
        mockCreate.mockRejectedValueOnce(
            Object.assign(new Error("aborted"), { name: "AbortError" })
        );

        const result = await handleSummary(queue);

        expect(isFallbackResponse(result)).toBe(true);
        if (isFallbackResponse(result)) {
            expect(result.reason).toBe("timeout");
        }
    });

    it("returns upstream_error fallback when the SDK throws a 500", async () => {
        mockCreate.mockRejectedValueOnce(new Error("Internal Server Error"));

        const result = await handleSummary(queue);

        expect(isFallbackResponse(result)).toBe(true);
        if (isFallbackResponse(result)) {
            expect(result.reason).toBe("upstream_error");
        }
    });
});