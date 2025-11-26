import { gateway } from "@ai-sdk/gateway";
import { openai } from '@ai-sdk/openai';
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";

export const myProvider =  customProvider({
  languageModels: {
    "chat-model": openai("gpt-4.1-mini"),
    "chat-model-reasoning": wrapLanguageModel({
      model: gateway.languageModel("xai/grok-3-mini"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "title-model": openai("gpt-4o-mini"),
    "artifact-model": openai("gpt-4.1-mini"),
  },
});
