import type { PolicyChunk } from "@/lib/retrieval";

export const HELP_PROMPT_VERSION = "help.v1" as const;

export const helpSystemPrompt = `You answer operational questions STRICTLY using the
provided policy excerpts. If the excerpts do not contain the answer, say so
and refuse to speculate. Cite the chunk ids you used.
Return ONLY JSON: {"answer": string, "citations": string[]}.`;

export function helpUserPrompt(
    question: string,
    chunks: Array<PolicyChunk & { score: number }>
): string {
    const ctx = chunks
        .map((c) => `[${c.id} — ${c.title}]\n${c.text}`)
        .join("\n\n");
    return [
        "Policy excerpts:",
        ctx,
        "",
        `QUESTION: ${question}`,
        "",
        "Respond with JSON only. citations must reference the chunk ids above.",
    ].join("\n");
}