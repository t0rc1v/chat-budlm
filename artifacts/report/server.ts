import { smoothStream, streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const reportDocumentHandler = createDocumentHandler<"report">({
  kind: "report",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: myProvider.languageModel("artifact-model"),
      system: `You are a professional report writer. Create a comprehensive, well-structured report on the given topic.
      Use proper report formatting with:
      - Clear title and date
      - Executive summary
      - Table of contents (as headings)
      - Introduction
      - Multiple sections with descriptive headings
      - Data, analysis, and findings
      - Conclusions and recommendations
      - Professional, formal tone
      
      Use markdown formatting with proper headings (##, ###), bullet points where appropriate, and emphasis.
      Make it detailed and informative.`,
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: title,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: "data-reportDelta",
          data: text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: myProvider.languageModel("artifact-model"),
      system: updateDocumentPrompt(document.content, "report"),
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: description,
      providerOptions: {
        openai: {
          prediction: {
            type: "content",
            content: document.content,
          },
        },
      },
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: "data-reportDelta",
          data: text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
});