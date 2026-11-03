"use client";

import { useAssistantStore } from "@/store/assistant";
import type { AiAction } from "@/schemas/ai";
import { useCallback } from "react";
import { isFallbackResponse } from "@/schemas/ai";
const ACTIONS: { key: AiAction; label: string }[] = [
    { key: "summary", label: "Present me Summary" },
    { key: "talk", label: "Talk to me" },
    { key: "help", label: "Help me" },
    { key: "teach", label: "Teach me" },
    { key: "greeting", label: "Replay Greeting" },
];

async function* readSse(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });

        const records = buffer.split("\n\n");
        buffer = records.pop() ?? "";

        for (const record of records) {
            const lines = record.split("\n");
            const eventLine = lines.find((l) => l.startsWith("event:"));
            const dataLine = lines.find((l) => l.startsWith("data:"));
            if (!eventLine || !dataLine) continue;
            const event = eventLine.slice(6).trim();
            try {
                const data = JSON.parse(dataLine.slice(5).trim());
                yield { event, data };
            } catch {
                /* Ignore malformed data lines — do not crash the stream. */
            }
        }
    }
}

export function AssistantPanel() {
    const {
        status,
        streamBuffer,
        response,
        error,
        start,
        appendToken,
        finish,
        fail,
    } = useAssistantStore();

    const run = useCallback(
        async (action: AiAction) => {
            start(action);
            try {
                const res = await fetch(`/api/ai/${action}`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({}),
                });

                /* 429 / 400 / network → typed UI fallback, not a crash. */
                if (res.status === 429) {
                    fail("Rate limit reached — please wait a moment before trying again.");
                    return;
                }
                if (!res.ok || !res.body) {
                    fail("The assistant is unavailable right now. Please try again.");
                    return;
                }

                for await (const { event, data } of readSse(res.body)) {
                    if (event === "token" && typeof data?.delta === "string") {
                        appendToken(data.delta);
                    } else if (event === "done") {
                        finish(data);
                        return;
                    }
                }
                /* Stream ended without a `done` event → treat as failure. */
                fail("The assistant did not return a complete response. Please retry.");
            } catch {
                fail("Network error — the assistant could not be reached.");
            }
        },
        [start, appendToken, finish, fail]
    );

    const isFallback = status === "fallback";
    const isStreaming = status === "streaming";
    const isLoading = status === "loading";

    return (
        <section
            aria-label="Approvals assistant"
            className="w-[420px] rounded-2xl bg-[#0f172a] p-4 text-white shadow-xl"
        >
            {/* Header — matches reference: "Approvals" + avatar + close */}
            <header className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-indigo-500 text-center leading-8">
                        A
                    </div>
                    <div>
                        <p className="text-sm font-semibold">Approvals</p>
                        <p className="text-xs text-slate-400">Hi, Admin!</p>
                    </div>
                </div>
                <button
                    type="button"
                    aria-label="Close"
                    onClick={() => useAssistantStore.getState().reset()}
                    className="rounded p-1 hover:bg-slate-700"
                >
                    ✕
                </button>
            </header>

            {/* Action grid — 2x2 + replay greeting */}
            <div className="grid grid-cols-2 gap-2">
                {ACTIONS.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        aria-label={label}
                        onClick={() => run(key)}
                        className="rounded-xl bg-slate-800 p-3 text-left text-sm hover:bg-slate-700 disabled:opacity-50"
                        disabled={isLoading || isStreaming}
                    >
                        {label}
                    </button>
                ))}
                {/* Replay Greeting is also in the grid above; keep this slot as
            a "Help me" style affordance in the reference. */}
            </div>

            {/* Streaming / done render area */}
            <div className="mt-4 min-h-[80px] rounded-xl bg-slate-900 p-3 text-sm">
                {isLoading && (
                    <p data-testid="assistant-loading" className="text-slate-400">
                        Thinking…
                    </p>
                )}

                {isStreaming && (
                    <pre data-testid="assistant-stream" className="whitespace-pre-wrap text-slate-300">
                        {streamBuffer}
                    </pre>
                )}

                {status === "done" && response && !isFallbackResponse(response) && (
                    <div>
                        {"spokenSummary" in response && (
                            <p className="text-slate-100">{response.spokenSummary}</p>
                        )}
                        {"reply" in response && <p>{response.reply}</p>}
                        {"answer" in response && <p>{response.answer}</p>}
                        {"greeting" in response && <p>{response.greeting}</p>}
                        {"step" in response && <p>{response.text}</p>}
                    </div>
                )}

                {isFallback && (
                    <div data-testid="assistant-fallback" className="text-amber-300">
                        <p>
                            {response && isFallbackResponse(response) ? response.message : error}
                        </p>
                        <button
                            type="button"
                            className="mt-2 rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-black"
                            onClick={() =>
                                useAssistantStore.getState().activeAction &&
                                run(useAssistantStore.getState().activeAction!)
                            }
                        >
                            Retry
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}