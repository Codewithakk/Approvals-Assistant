import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssistantPanel } from "@/components/AssistantPanel/AssistantPanel";
import { useAssistantStore } from "@/store/assistant";


function makeSseStream(events: Array<{ event: string; data: unknown }>) {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        async start(controller) {
            for (const { event, data } of events) {
                const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(chunk));
                await new Promise((r) => setTimeout(r, 10));
            }
            controller.close();
        },
    });
}

const VALID_SUMMARY_DONE = {
    action: "summary",
    items: [{ id: "1", priority: 1, reason: "Blocks onboarding" }],
    spokenSummary: "One urgent item blocks onboarding.",
};

beforeEach(() => {
    useAssistantStore.getState().reset();
    vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* Structure                                                           */
/* ------------------------------------------------------------------ */

describe("AssistantPanel — structure", () => {
    it("renders the header, close affordance, and all 5 action entry points", () => {
        render(<AssistantPanel />);
        expect(screen.getByText(/Approvals/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /present me summary/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /talk to me/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /help me/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /teach me/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /replay greeting/i })).toBeInTheDocument();
    });
});

/* ------------------------------------------------------------------ */
/* LOADING                                                             */
/* ------------------------------------------------------------------ */

describe("AssistantPanel — loading state", () => {
    it("shows a loading indicator immediately after clicking an action", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => new Promise<Response>(() => { })) as unknown as typeof fetch
        );

        render(<AssistantPanel />);
        await userEvent.click(
            screen.getByRole("button", { name: /present me summary/i })
        );

        expect(screen.getByTestId("assistant-loading")).toBeInTheDocument();
        expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    });
});

/* ------------------------------------------------------------------ */
/* STREAMING                                                           */
/* ------------------------------------------------------------------ */

describe("AssistantPanel — streaming state", () => {
    it("renders tokens incrementally, then the final validated payload", async () => {
        const stream = makeSseStream([
            { event: "token", data: { delta: '{"action":"summary",' } },
            { event: "token", data: { delta: '"spokenSummary":"One urgent' } },
            { event: "token", data: { delta: ' item blocks onboarding."}' } },
            { event: "done", data: VALID_SUMMARY_DONE },
        ]);

        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                new Response(stream, {
                    headers: { "content-type": "text/event-stream" },
                })
            ) as unknown as typeof fetch
        );

        render(<AssistantPanel />);
        await userEvent.click(
            screen.getByRole("button", { name: /present me summary/i })
        );

        await waitFor(
            () => expect(screen.getByTestId("assistant-stream")).toBeInTheDocument(),
            { timeout: 2000 }
        );

        expect(screen.queryByTestId("assistant-loading")).not.toBeInTheDocument();

        await waitFor(
            () =>
                expect(
                    screen.getByText(/One urgent item blocks onboarding\./)
                ).toBeInTheDocument(),
            { timeout: 2000 }
        );
        expect(screen.queryByTestId("assistant-stream")).not.toBeInTheDocument();
    });

    it("ignores malformed token chunks but still renders the final payload", async () => {
        const stream = makeSseStream([
            { event: "token", data: { delta: "garbage{{{" } },
            { event: "done", data: VALID_SUMMARY_DONE },
        ]);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                new Response(stream, {
                    headers: { "content-type": "text/event-stream" },
                })
            ) as unknown as typeof fetch
        );
        render(<AssistantPanel />);
        await userEvent.click(
            screen.getByRole("button", { name: /present me summary/i })
        );
        await waitFor(
            () =>
                expect(
                    screen.getByText(/One urgent item blocks onboarding\./)
                ).toBeInTheDocument(),
            { timeout: 2000 }
        );
    });
});

/* ------------------------------------------------------------------ */
/* ERROR                                                               */
/* ------------------------------------------------------------------ */

describe("AssistantPanel — error state", () => {
    it("renders the typed fallback message when the server streams a fallback", async () => {
        const stream = makeSseStream([
            {
                event: "done",
                data: {
                    fallback: true,
                    action: "summary",
                    reason: "timeout",
                    message:
                        "You have 4 items pending review. AI summary is unavailable right now.",
                },
            },
        ]);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                new Response(stream, {
                    headers: { "content-type": "text/event-stream" },
                })
            ) as unknown as typeof fetch
        );

        render(<AssistantPanel />);
        await userEvent.click(
            screen.getByRole("button", { name: /present me summary/i })
        );

        await waitFor(
            () => expect(screen.getByTestId("assistant-fallback")).toBeInTheDocument(),
            { timeout: 2000 }
        );
        expect(
            screen.getByText(/You have 4 items pending review/i)
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    it("renders a network-error fallback (not a crash) when fetch throws", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new Error("Network down");
            }) as unknown as typeof fetch
        );

        render(<AssistantPanel />);
        await userEvent.click(
            screen.getByRole("button", { name: /present me summary/i })
        );

        await waitFor(
            () => expect(screen.getByTestId("assistant-fallback")).toBeInTheDocument(),
            { timeout: 2000 }
        );
        expect(screen.queryByTestId("assistant-loading")).not.toBeInTheDocument();
    });

    it("renders a fallback when the server returns 429 (rate limited)", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                new Response(
                    JSON.stringify({ error: "rate_limited", retryAfterSec: 30 }),
                    { status: 429, headers: { "content-type": "application/json" } }
                )
            ) as unknown as typeof fetch
        );

        render(<AssistantPanel />);
        await userEvent.click(
            screen.getByRole("button", { name: /present me summary/i })
        );

        await waitFor(
            () => expect(screen.getByTestId("assistant-fallback")).toBeInTheDocument(),
            { timeout: 2000 }
        );
        expect(screen.getByText(/rate limit|too many|wait/i)).toBeInTheDocument();
    });
});