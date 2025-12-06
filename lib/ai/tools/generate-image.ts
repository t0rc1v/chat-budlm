// lib/ai/tools/generate-image.ts - FIXED VERSION
import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { saveDocument } from "@/lib/db/queries";

type GenerateImageProps = {
  userId: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const generateImage = ({ userId, dataStream }: GenerateImageProps) =>
  tool({
    description: `Generate, create, or make images based on text descriptions. 
    Use this tool when the user explicitly asks to:
    - Generate an image
    - Create a picture/photo/illustration
    - Make a visual/graphic
    - Draw something
    - Produce artwork
    Examples: "generate an image of...", "create a picture of...", "make me a photo of..."`,
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          "Detailed text description of the image to generate. Be specific about style, composition, colors, mood, and details."
        ),
      aspectRatio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
        .optional()
        .describe("Aspect ratio for the generated image. Default is 1:1"),
    }),
    execute: async ({ prompt, aspectRatio = "1:1" }) => {
      try {
        console.log("🎨 Starting image generation with prompt:", prompt);
        const id = generateUUID();

        // Generate a concise title from the prompt (first 50 chars or until first period/newline)
        const generateTitle = (prompt: string): string => {
          const cleaned = prompt
            .split(/[.\n]/)[0] // Take first sentence or line
            .trim()
            .substring(0, 60); // Max 60 chars
          
          return cleaned.length < prompt.length ? `${cleaned}...` : cleaned;
        };

        const imageTitle = generateTitle(prompt);

        // Notify that image generation has started
        dataStream.write({
          type: "data-kind",
          data: "image",
          transient: true,
        });

        dataStream.write({
          type: "data-id",
          data: id,
          transient: true,
        });

        dataStream.write({
          type: "data-title",
          data: imageTitle,
          transient: true,
        });

        dataStream.write({
          type: "data-clear",
          data: null,
          transient: true,
        });

        console.log("📡 Calling Gemini 2.5 Flash Image model...");

        // Generate image using Gemini 2.5 Flash Image
        const result = await generateText({
          model: google('gemini-2.5-flash-image-preview'),
          providerOptions: {
            google: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          },
          prompt,
        });

        console.log("✅ Received response from Gemini");
        console.log("Response text length:", result.text?.length);

        // Extract image data from response
        let imageBase64 = "";

        for (const file of result.files || []) {
          if (file.mediaType.startsWith('image/')) {
            imageBase64 = file.base64;
            break;
          }
        }

        console.log("🖼️ Image base64 extracted, length:", imageBase64.length);

        if (!imageBase64 || imageBase64.length < 100) {
          console.error("❌ No valid image data received");
          throw new Error("No image data received from the model");
        }

        // Stream the image data progressively
        dataStream.write({
          type: "data-imageDelta",
          data: imageBase64,
          transient: true,
        });

        console.log("💾 Saving document to database...");

        // Save the full data URL to database for later retrieval
        const fullDataUrl = `data:image/png;base64,${imageBase64}`;
        
        if (userId) {
          await saveDocument({
            id,
            title: imageTitle,
            content: fullDataUrl,
            kind: "image",
            userId: userId,
          });
          console.log("✅ Image saved to database with length:", fullDataUrl.length);
        } else {
          console.log("⚠️ No userId, skipping database save");
        }

        dataStream.write({
          type: "data-finish",
          data: null,
          transient: true,
        });

        console.log("✅ Image generation complete!");

        // Return document format (like createDocument tool does)
        return {
          id,
          title: imageTitle,
          kind: "image" as const,
        };
      } catch (error: any) {
        console.error("❌ Error generating image:", error);
        
        return {
          error: `Failed to generate image: ${error.message || "Unknown error"}`,
          suggestion: "Try with a more specific or detailed prompt, or check your API key configuration",
        };
      }
    },
  });