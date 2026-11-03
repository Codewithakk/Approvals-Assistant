import express from "express";
import { NextRequest } from "next/server";
import { POST as aiHandler } from "@/app/api/ai/[action]/route";

export function buildTestApp() {
    const app = express();
    app.use(express.json());

    app.post("/api/ai/:action", async (req, res) => {
        const url = `http://localhost/api/ai/${req.params.action}`;
        const baseRequest = new Request(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(req.body),
        });
        const nextReq = new NextRequest(baseRequest);

        const nextRes = await aiHandler(nextReq);

        res.status(nextRes.status);
        nextRes.headers.forEach((v, k) => res.setHeader(k, v));

        if (!nextRes.body) {
            res.end();
            return;
        }

        const reader = nextRes.body.getReader();
        const pump = async (): Promise<void> => {
            const { done, value } = await reader.read();
            if (done) {
                res.end();
                return;
            }
            res.write(Buffer.from(value));
            return pump();
        };
        return pump();
    });

    app.use(
        (
            err: Error,
            _req: express.Request,
            res: express.Response,
            _next: express.NextFunction
        ) => {
            // eslint-disable-next-line no-console
            console.error("[test-app] handler threw:", err);
            res.status(500).json({ error: "test_app_crash", message: err.message });
        }
    );

    return app;
}