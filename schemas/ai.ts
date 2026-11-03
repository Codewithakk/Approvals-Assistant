import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export const AiActionSchema = z.enum([
    "summary",
    "talk",
    "help",
    "teach",
    "greeting",
]);
export type AiAction = z.infer<typeof AiActionSchema>;

export const FallbackResponseSchema = z.object({
    fallback: z.literal(true),
    action: AiActionSchema,
    reason: z.enum(["timeout", "invalid_shape", "upstream_error", "rate_limited"]),
    message: z.string(), // user-facing, context-aware
});
export type FallbackResponse = z.infer<typeof FallbackResponseSchema>;

/* ------------------------------------------------------------------ */
/* 1. Present me Summary                                               */
/* ------------------------------------------------------------------ */

export const SummaryItemSchema = z.object({
    id: z.string(),
    priority: z.number().int().min(1).max(5), // 1 = most urgent
    reason: z.string().min(1),
});
export type SummaryItem = z.infer<typeof SummaryItemSchema>;

export const SummaryResponseSchema = z.object({
    action: z.literal("summary"),
    items: z.array(SummaryItemSchema).min(1),
    spokenSummary: z.string().min(1), // operator's language, prioritised
});
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

/* ------------------------------------------------------------------ */
/* 2. Talk to me (multi-turn)                                          */
/* ------------------------------------------------------------------ */

export const ChatTurnSchema = z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const TalkRequestSchema = z.object({
    action: z.literal("talk"),
    history: z.array(ChatTurnSchema).max(20), // cap prevents runaway prompts
    message: z.string().min(1).max(2000),
});
export type TalkRequest = z.infer<typeof TalkRequestSchema>;

export const TalkResponseSchema = z.object({
    action: z.literal("talk"),
    reply: z.string().min(1),
});
export type TalkResponse = z.infer<typeof TalkResponseSchema>;

/* ------------------------------------------------------------------ */
/* 3. Help me (RAG-grounded)                                           */
/* ------------------------------------------------------------------ */

export const HelpRequestSchema = z.object({
    action: z.literal("help"),
    question: z.string().min(1).max(1000),
});
export type HelpRequest = z.infer<typeof HelpRequestSchema>;

export const HelpResponseSchema = z.object({
    action: z.literal("help"),
    answer: z.string().min(1),
    citations: z.array(z.string()).min(1), // chunk ids from policy.md
});
export type HelpResponse = z.infer<typeof HelpResponseSchema>;

/* ------------------------------------------------------------------ */
/* 4. Teach me                    */
/* ------------------------------------------------------------------ */

export const TeachRequestSchema = z.object({
    action: z.literal("teach"),
    itemId: z.string().optional(),
    step: z.number().int().min(1).optional(),
    followUp: z.string().optional(),
});
export type TeachRequest = z.infer<typeof TeachRequestSchema>;

export const TeachResponseSchema = z.object({
    action: z.literal("teach"),
    step: z.number().int().min(1),
    totalSteps: z.number().int().min(1),
    text: z.string().min(1),
    done: z.boolean(),
});
export type TeachResponse = z.infer<typeof TeachResponseSchema>;

/* ------------------------------------------------------------------ */
/* 5. Replay Greeting                                                  */
/* ------------------------------------------------------------------ */

export const GreetingRequestSchema = z.object({
    action: z.literal("greeting"),
});
export type GreetingRequest = z.infer<typeof GreetingRequestSchema>;

export const GreetingResponseSchema = z.object({
    action: z.literal("greeting"),
    greeting: z.string().min(1).max(300),
});
export type GreetingResponse = z.infer<typeof GreetingResponseSchema>;

/* ------------------------------------------------------------------ */
/* Union helpers                                                       */
/* ------------------------------------------------------------------ */

export const AiSuccessResponseSchema = z.discriminatedUnion("action", [
    SummaryResponseSchema,
    TalkResponseSchema,
    HelpResponseSchema,
    TeachResponseSchema,
    GreetingResponseSchema,
]);
export type AiSuccessResponse = z.infer<typeof AiSuccessResponseSchema>;

export const AiResponseSchema = z.union([
    AiSuccessResponseSchema,
    FallbackResponseSchema,
]);
export type AiResponse = z.infer<typeof AiResponseSchema>;
/** Runtime + type narrowing for the fallback branch of AiResponse. */
export function isFallbackResponse(r: AiResponse): r is FallbackResponse {
    return (r as { fallback?: boolean }).fallback === true;
}