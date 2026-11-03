export const TEACH_PROMPT_VERSION = "teach.v1" as const;

export const teachSystemPrompt = `You are a patient trainer walking a new operator
through reviewing ONE approval. Produce ONE step at a time.
Return ONLY JSON: {"step": number, "totalSteps": number, "text": string, "done": boolean}.
The user may ask a follow-up about the current step — answer it and optionally
advance one step. Never jump ahead more than one step.`;

export function teachUserPrompt(
    step: number,
    followUp?: string
): string {
    return [
        `Current step: ${step}.`,
        followUp ? `Operator follow-up: ${followUp}` : "No follow-up yet.",
        'Respond with JSON only. If no more steps remain, set done: true.',
    ].join("\n");
}