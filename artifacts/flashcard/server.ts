// artifacts/flashcard/server.ts
import { streamObject } from "ai";
import { z } from "zod";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { updateDocumentPrompt } from "@/lib/ai/prompts";

const flashcardSchema = z.object({
  title: z.string().describe("The title of the flashcard set"),
  cards: z.array(
    z.object({
      front: z.string().describe("The front of the flashcard (question/term)"),
      back: z
        .string()
        .describe("The back of the flashcard (answer/definition)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional tags for categorization"),
    })
  ),
});

const flashcardPrompt = `You are a flashcard generator. Create effective study flashcards based on the given topic.

Requirements:
- Generate 10-20 flashcards
- Front: Clear, concise questions or terms
- Back: Accurate, complete answers or definitions
- Use active recall principles
- Include relevant tags for organization
- Vary difficulty and coverage
- Make cards atomic (one concept per card)`;

export const flashcardDocumentHandler = createDocumentHandler<"flashcard">({
  kind: "flashcard",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { partialObjectStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: flashcardPrompt,
      prompt: title,
      schema: flashcardSchema,
    });

    for await (const partialObject of partialObjectStream) {
      const content = JSON.stringify(partialObject, null, 2);
      
      dataStream.write({
        type: "data-flashcardDelta",
        data: content,
        transient: true,
      });

      draftContent = content;
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    const { partialObjectStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: updateDocumentPrompt(document.content || "", "flashcard"),
      prompt: description,
      schema: flashcardSchema,
    });

    for await (const partialObject of partialObjectStream) {
      const content = JSON.stringify(partialObject, null, 2);
      
      dataStream.write({
        type: "data-flashcardDelta",
        data: content,
        transient: true,
      });

      draftContent = content;
    }

    return draftContent;
  },
});