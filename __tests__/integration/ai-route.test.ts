import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import request from "supertest";
import { buildTestApp } from "../helpers/app";

var mockCreate: any;

jest.mock("@anthropic-ai/sdk", () => ({
    __esModule: true,
    default: class MockAnthropic {
        messages = { create: (...args: unknown[]) => mockCreate(...args) };
        constructor(_opts: unknown) { }
    },
}));

import { resetRateLimit } from "@/lib/rate-limit";

const app = buildTestApp();

beforeEach(() => {
    mockCreate = jest.fn();
    resetRateLimit();
});

function mockClaudeReturns(json: unknown) {
    mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(json) }],
    });
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("POST /api/ai/summary — success path", () => {
    it("returns 200 with a valid SummaryResponse body", async () => {
        mockClaudeReturns({
            action: "summary",
            items: [{ id: "1", priority: 1, reason: "Blocks onboarding" }],
            spokenSummary: "One urgent item blocks onboarding.",
        });

        const res = await request(app).post("/api/ai/summary").send({});

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
        expect(res.text).toContain("event: done");
        expect(res.text).toContain('"action":"summary"');
        expect(res.text).toContain('"priority":1');
    });
});

describe("POST /api/ai/summary — timeout fallback (§6: kill the key / force timeout)", () => {
    it("streams a typed fallback (never a raw 500) when the LLM hangs >8s", async () => {
        mockCreate!.mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    const err = new Error("aborted");
                    err.name = "AbortError";
                    setTimeout(() => reject(err), 50);
                })
        );

        const res = await request(app).post("/api/ai/summary").send({});
        expect(res.status).toBe(200);
        expect(res.text).toContain('"fallback":true');
        expect(res.text).toContain('"reason":"timeout"');
        expect(res.text).toMatch(/4 items/);
    });

    it("streams a typed fallback when the API key is missing/invalid", async () => {
        mockCreate.mockRejectedValueOnce(
            Object.assign(new Error("401 invalid_api_key"), { status: 401 })
        );

        const res = await request(app).post("/api/ai/summary").send({});

        expect(res.status).toBe(200);
        expect(res.text).toContain('"reason":"upstream_error"');
    });
});

describe("POST /api/ai/summary — rate limiting", () => {
    it("returns 429 after exceeding the per-session throttle", async () => {
        mockClaudeReturns({
            action: "summary",
            items: [{ id: "1", priority: 1, reason: "x" }],
            spokenSummary: "x",
        });

        const results = [];
        for (let i = 0; i < 11; i++) {
            results.push(await request(app).post("/api/ai/summary").send({}));
        }

        const last = results[results.length - 1];
        expect(last.status).toBe(429);
        expect(last.body.error).toBe("rate_limited");
    });
});

describe("POST /api/ai/summary — bad request", () => {
    it("rejects unknown action with 400", async () => {
        const res = await request(app)
            .post("/api/ai/not-a-real-action")
            .send({});
        expect(res.status).toBe(400);
    });
});