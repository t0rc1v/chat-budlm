import { streamObject } from "ai";
import { z } from "zod";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

const slidesSchema = z.object({
  title: z.string().describe("The main title of the presentation"),
  subtitle: z.string().optional().describe("Optional subtitle for the title slide"),
  slides: z.array(
    z.object({
      title: z.string().describe("The title of this slide"),
      content: z.array(z.string()).describe("Array of bullet points or content items"),
      notes: z.string().optional().describe("Optional speaker notes for this slide"),
    })
  ),
});

export const slidesDocumentHandler = createDocumentHandler<"slides">({
  kind: "slides",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: `You are a presentation designer. Create engaging presentation slides based on the given topic.
      Generate 5-10 content slides (not including title slide) with:
      - Clear, concise titles for each slide
      - 3-5 bullet points per slide
      - Content that flows logically from slide to slide
      - Optional speaker notes for key points
      
      Keep bullet points brief and impactful. Use active voice and clear language.
      Structure the presentation with introduction, main points, and conclusion.`,
      prompt: title,
      schema: slidesSchema,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;

        if (object) {
          const content = JSON.stringify(object, null, 2);
          dataStream.write({
            type: "data-slidesDelta",
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
      system: updateDocumentPrompt(document.content, "slides"),
      prompt: description,
      schema: slidesSchema,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;

        if (object) {
          const content = JSON.stringify(object, null, 2);
          dataStream.write({
            type: "data-slidesDelta",
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