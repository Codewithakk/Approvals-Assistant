import { z } from "zod";

export const ApprovalTypeSchema = z.enum(["Folder", "Video", "PDF", "Image"]);
export type ApprovalType = z.infer<typeof ApprovalTypeSchema>;

export const ApprovalStatusSchema = z.enum(["Pending Review"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalItemSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: ApprovalTypeSchema,
    submittedBy: z.string().min(1),
    status: ApprovalStatusSchema,
    submittedAt: z.string().datetime(), // ISO 8601
});
export type ApprovalItem = z.infer<typeof ApprovalItemSchema>;

export const ApprovalQueueSchema = z.array(ApprovalItemSchema).min(1);
export type ApprovalQueue = z.infer<typeof ApprovalQueueSchema>;