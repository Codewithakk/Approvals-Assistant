import fs from "node:fs";
import path from "node:path";

export type PolicyChunk = {
    id: string;
    title: string;
    text: string;
    tokens: string[];
};

const STOPWORDS = new Set(
    "the a an and or of to in on is are was were for with that this it be as at by from if then than so".split(" ")
);

function tokenize(s: string): string[] {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

let cached: PolicyChunk[] | null = null;

export function loadPolicyChunks(): PolicyChunk[] {
    if (cached) return cached;

    const raw = fs.readFileSync(
        path.join(process.cwd(), "data", "policy.md"),
        "utf8"
    );

    /* Split on "## Chunk N — Title" headings. */
    const blocks = raw.split(/^## /m).filter(Boolean);
    const chunks: PolicyChunk[] = blocks.map((block) => {
        const [heading, ...rest] = block.split("\n");
        const title = heading.replace(/^Chunk \d+ — /, "").trim();
        const idMatch = heading.match(/^Chunk \d+/);
        const id = idMatch ? idMatch[0] : "Chunk";
        const text = rest.join("\n").trim();
        return { id, title, text, tokens: tokenize(`${title} ${text}`) };
    });

    cached = chunks;
    return chunks;
}

export function retrieveTopK(
    query: string,
    k = 2
): Array<PolicyChunk & { score: number }> {
    const qTokens = tokenize(query);
    if (qTokens.length === 0) return [];

    const qSet = new Set(qTokens);
    const chunks = loadPolicyChunks();

    const scored = chunks
        .map((c) => {
            let overlap = 0;
            for (const t of c.tokens) if (qSet.has(t)) overlap++;
            const score = overlap / Math.sqrt(c.tokens.length + 1);
            return { ...c, score };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);

    return scored;
}