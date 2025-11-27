// artifacts/quiz/server.ts
import { streamObject } from "ai";
import { z } from "zod";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { updateDocumentPrompt } from "@/lib/ai/prompts";

const quizSchema = z.object({
  title: z.string().describe("The title of the quiz"),
  questions: z.array(
    z.object({
      question: z.string().describe("The question text"),
      options: z
        .array(z.string())
        .length(4)
        .describe("Four multiple choice options"),
      correctAnswer: z
        .number()
        .min(0)
        .max(3)
        .describe("Index of the correct answer (0-3)"),
      explanation: z
        .string()
        .optional()
        .describe("Optional explanation of the correct answer"),
    })
  ),
});

const quizPrompt = `You are a quiz generator. Create an engaging and educational multiple-choice quiz based on the given topic.

Requirements:
- Generate 5-10 questions
- Each question should have exactly 4 options
- Provide clear, unambiguous questions
- Include helpful explanations for correct answers
- Vary difficulty levels appropriately
- Ensure options are plausible but clearly distinguishable`;

export const quizDocumentHandler = createDocumentHandler<"quiz">({
  kind: "quiz",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { partialObjectStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: quizPrompt,
      prompt: title,
      schema: quizSchema,
    });

    for await (const partialObject of partialObjectStream) {
      const content = JSON.stringify(partialObject, null, 2);
      
      dataStream.write({
        type: "data-quizDelta",
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
      system: updateDocumentPrompt(document.content || "", "quiz"),
      prompt: description,
      schema: quizSchema,
    });

    for await (const partialObject of partialObjectStream) {
      const content = JSON.stringify(partialObject, null, 2);
      
      dataStream.write({
        type: "data-quizDelta",
        data: content,
        transient: true,
      });

      draftContent = content;
    }

    return draftContent;
  },
});