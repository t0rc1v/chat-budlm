// artifacts/report/server.ts
import { streamObject } from "ai";
import { z } from "zod";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { updateDocumentPrompt } from "@/lib/ai/prompts";

const reportSchema = z.object({
  title: z.string().describe("The report title"),
  subtitle: z.string().optional().describe("Optional subtitle"),
  author: z.string().optional().describe("Author name"),
  date: z.string().optional().describe("Report date"),
  summary: z.string().describe("Executive summary or abstract"),
  sections: z.array(
    z.object({
      title: z.string().describe("Section title"),
      content: z.string().describe("Section content in markdown"),
      subsections: z
        .array(
          z.object({
            title: z.string(),
            content: z.string(),
          })
        )
        .optional(),
    })
  ),
  conclusion: z.string().optional().describe("Conclusion section"),
  references: z
    .array(z.string())
    .optional()
    .describe("List of references or citations"),
});

const reportPrompt = `You are a professional report writer. Create a well-structured, comprehensive report on the given topic.

Requirements:
- Professional and formal tone
- Clear executive summary
- Well-organized sections with logical flow
- Use markdown for formatting (bold, italics, lists, etc.)
- Include data and evidence where applicable
- Proper conclusion summarizing key points
- Include references if applicable
- Aim for 3-5 main sections with subsections as needed`;

export const reportDocumentHandler = createDocumentHandler<"report">({
  kind: "report",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { partialObjectStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: reportPrompt,
      prompt: title,
      schema: reportSchema,
    });

    for await (const partialObject of partialObjectStream) {
      const content = JSON.stringify(partialObject, null, 2);
      
      dataStream.write({
        type: "data-reportDelta",
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
      system: updateDocumentPrompt(document.content || "", "report"),
      prompt: description,
      schema: reportSchema,
    });

    for await (const partialObject of partialObjectStream) {
      const content = JSON.stringify(partialObject, null, 2);
      
      dataStream.write({
        type: "data-reportDelta",
        data: content,
        transient: true,
      });

      draftContent = content;
    }

    return draftContent;
  },
});