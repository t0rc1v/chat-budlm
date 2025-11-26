import { gateway } from "@ai-sdk/gateway";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";

export const myProvider =  customProvider({
  languageModels: {
    "chat-model": gateway.languageModel("openai/gpt-4.1-mini"),
    "chat-model-reasoning": wrapLanguageModel({
      model: gateway.languageModel("xai/grok-3-mini"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "title-model": gateway.languageModel("openai/gpt-4o-mini"),
    "artifact-model": gateway.languageModel("openai/gpt-4.1-mini"),
  },
});
