import { z } from "zod";
import { buildSystemPromptWithTools } from "@/lib/ai/prompts";
import type { WritingStyle } from "@/lib/stores/use-tools-store";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

export const postRequestBodySchema = z.object({
  id: z.uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum(["chat-model", "chat-model-reasoning"]),
  selectedVisibilityType: z.enum(["public", "private"]),
  projectId: z.uuid().optional().nullable(),
  selectedFileIds: z.array(z.uuid()).optional(),
  toolsSettings: z.object({
    guidedLearning: z.boolean().optional().default(false),
    writingStyle: z.enum(['normal', 'learning', 'formal', 'concise', 'explanatory']).optional().default('normal'),
    imageGeneration: z.boolean().optional().default(false),
  }).optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
