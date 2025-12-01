import { streamObject } from "ai";
import { z } from "zod";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

const flashcardSchema = z.object({
  title: z.string().describe("The title of the flashcard set"),
  cards: z.array(
    z.object({
      front: z.string().describe("The question or term on the front of the card"),
      back: z.string().describe("The answer or definition on the back of the card"),
      category: z.string().optional().describe("Optional category or tag for the card"),
    })
  ),
});

export const flashcardDocumentHandler = createDocumentHandler<"flashcard">({
  kind: "flashcard",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: `You are a flashcard generator. Create educational flashcards based on the given topic.
      Generate 10-20 flashcards with clear, concise questions on the front and accurate answers on the back.
      Keep the front side brief (one question or term) and the back side informative but concise.
      Optionally add categories to group related cards.`,
      prompt: title,
      schema: flashcardSchema,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;

        if (object) {
          const content = JSON.stringify(object, null, 2);
          dataStream.write({
            type: "data-flashcardDelta",
            data: content,
            transient: true,
          });

          draftContent = content;
        }
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: updateDocumentPrompt(document.content, "flashcard"),
      prompt: description,
      schema: flashcardSchema,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;

        if (object) {
          const content = JSON.stringify(object, null, 2);
          dataStream.write({
            type: "data-flashcardDelta",
            data: content,
            transient: true,
          });

          draftContent = content;
        }
      }
    }

    return draftContent;
  },
});