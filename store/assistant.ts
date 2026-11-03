import { create } from "zustand";
import type { AiAction, AiResponse } from "@/schemas/ai";
import { AiResponseSchema, isFallbackResponse } from "@/schemas/ai";

type Status = "idle" | "loading" | "streaming" | "done" | "fallback";

type State = {
    status: Status;
    activeAction: AiAction | null;
    streamBuffer: string;
    response: AiResponse | null;
    error: string | null;
};

type Actions = {
    start: (action: AiAction) => void;
    appendToken: (delta: string) => void;
    finish: (payload: unknown) => void;
    fail: (message: string) => void;
    reset: () => void;
};

const initial: State = {
    status: "idle",
    activeAction: null,
    streamBuffer: "",
    response: null,
    error: null,
};

export const useAssistantStore = create<State & Actions>((set) => ({
    ...initial,
    start: (action) =>
        set({
            status: "loading",
            activeAction: action,
            streamBuffer: "",
            response: null,
            error: null,
        }),
    appendToken: (delta) =>
        set((s) => ({
            status: "streaming",
            streamBuffer: s.streamBuffer + delta,
        })),
    finish: (payload) => {
        const parsed = AiResponseSchema.safeParse(payload);
        if (!parsed.success) {

            set({
                status: "fallback",
                error: "Received an invalid response from the assistant.",
            });
            return;
        }
        set({
            status: isFallbackResponse(parsed.data) ? "fallback" : "done",
            response: parsed.data,
            streamBuffer: "",
        });
    },
    fail: (message) =>
        set({ status: "fallback", error: message, streamBuffer: "" }),
    reset: () => set(initial),
}));