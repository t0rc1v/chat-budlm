// artifacts/image/server.ts 
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const imageDocumentHandler = createDocumentHandler<"image">({
  kind: "image",
  onCreateDocument: async ({ title, dataStream }) => {
    console.log("🎨 Image document handler - creating with title:", title);
    
    let imageBase64 = "";

    try {
      // Generate image using Gemini
      const result = await generateText({
        model: google("gemini-2.5-flash-image-preview"),
        providerOptions: {
          google: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        },
        prompt: title, // The title is the prompt
      });

      console.log("✅ Gemini response received");

      // Extract base64 from response files
      for (const file of result.files || []) {
        if (file.mediaType.startsWith('image/')) {
          imageBase64 = file.base64;
          console.log("🖼️ Image base64 extracted, length:", imageBase64.length);
          break;
        }
      }

      if (!imageBase64 || imageBase64.length < 100) {
        console.error("❌ No valid image data received");
        throw new Error("No image data received from the model");
      }

      // Stream the image data (just base64, no prefix)
      dataStream.write({
        type: "data-imageDelta",
        data: imageBase64,
        transient: true,
      });

      console.log("✅ Image streamed successfully");

      // Return FULL data URL for storage in database
      return `data:image/png;base64,${imageBase64}`;
    } catch (error) {
      console.error("❌ Error in image document handler:", error);
      throw error;
    }
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    // Image updates would regenerate the image with modified prompt
    console.log("🔄 Updating image with description:", description);
    
    let imageBase64 = "";

    try {
      const result = await generateText({
        model: google("gemini-2.5-flash-image-preview"),
        providerOptions: {
          google: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        },
        prompt: `${document.title}. ${description}`,
      });

      // Extract base64 from response files
      for (const file of result.files || []) {
        if (file.mediaType.startsWith('image/')) {
          imageBase64 = file.base64;
          break;
        }
      }

      if (!imageBase64 || imageBase64.length < 100) {
        throw new Error("No image data received from the model");
      }

      dataStream.write({
        type: "data-imageDelta",
        data: imageBase64,
        transient: true,
      });

      // Return FULL data URL for storage
      return `data:image/png;base64,${imageBase64}`;
    } catch (error) {
      console.error("❌ Error updating image:", error);
      throw error;
    }
  },
});