import { streamObject } from "ai";
import { z } from "zod";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

const quizSchema = z.object({
  title: z.string().describe("The title of the quiz"),
  questions: z.array(
    z.object({
      question: z.string().describe("The question text"),
      options: z.array(z.string()).describe("Array of answer options"),
      correctAnswer: z.number().describe("Index of the correct answer (0-based)"),
      explanation: z.string().optional().describe("Explanation for the correct answer"),
    })
  ),
});

export const quizDocumentHandler = createDocumentHandler<"quiz">({
  kind: "quiz",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: `You are a quiz generator. Create an engaging and educational quiz based on the given topic. 
      Include 5-10 multiple choice questions with 4 options each. 
      Always include explanations for correct answers to help learners understand.
      Make sure the correctAnswer index corresponds to the correct option in the options array (0-based indexing).`,
      prompt: title,
      schema: quizSchema,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;

        if (object) {
          const content = JSON.stringify(object, null, 2);
          dataStream.write({
            type: "data-quizDelta",
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
      system: updateDocumentPrompt(document.content, "quiz"),
      prompt: description,
      schema: quizSchema,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;

        if (object) {
          const content = JSON.stringify(object, null, 2);
          dataStream.write({
            type: "data-quizDelta",
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