// artifacts/slides/server.ts
import { streamObject } from "ai";
import { z } from "zod";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { updateDocumentPrompt } from "@/lib/ai/prompts";

const slideSchema = z.object({
  type: z
    .enum(["title", "content", "image", "two-column", "quote"])
    .describe("Type of slide"),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.string().optional().describe("Main content in markdown"),
  leftContent: z.string().optional().describe("Left column content for two-column"),
  rightContent: z.string().optional().describe("Right column content for two-column"),
  quote: z.string().optional().describe("Quote text"),
  author: z.string().optional().describe("Quote author"),
  imageUrl: z.string().optional().describe("Image URL (placeholder for now)"),
  bulletPoints: z.array(z.string()).optional().describe("List of bullet points"),
});

const slidesSchema = z.object({
  title: z.string().describe("Presentation title"),
  author: z.string().optional().describe("Presentation author"),
  date: z.string().optional().describe("Presentation date"),
  slides: z.array(slideSchema).describe("Array of slides"),
});

const slidesPrompt = `You are a presentation designer. Create engaging, well-structured slides on the given topic.

Requirements:
- Start with a title slide
- Create 8-12 content slides
- Use variety: content, two-column, quote slides
- Keep text concise and impactful
- Use bullet points effectively
- Include a closing/summary slide
- Balance text with white space
- Ensure logical flow and storytelling`;

export const slidesDocumentHandler = createDocumentHandler<"slides">({
  kind: "slides",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { partialObjectStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: slidesPrompt,
      prompt: title,
      schema: slidesSchema,
    });

    for await (const partialObject of partialObjectStream) {
      const content = JSON.stringify(partialObject, null, 2);
      
      dataStream.write({
        type: "data-slidesDelta",
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
      system: updateDocumentPrompt(document.content || "", "slides"),
      prompt: description,
      schema: slidesSchema,
    });

    for await (const partialObject of partialObjectStream) {
      const content = JSON.stringify(partialObject, null, 2);
      
      dataStream.write({
        type: "data-slidesDelta",
        data: content,
        transient: true,
      });

      draftContent = content;
    }

    return draftContent;
  },
});