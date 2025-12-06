import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type CreateDocumentProps = {
  userId: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  imageGenerationEnabled?: boolean;
};

export const createDocument = ({ userId, dataStream, imageGenerationEnabled = false, }: CreateDocumentProps) => {
  // Filter artifact kinds based on settings
  const allowedArtifactKinds = artifactKinds.filter((kind) => {
    // If image generation is disabled, exclude 'image' from allowed kinds
    if (kind === "image" && !imageGenerationEnabled) {
      return false;
    }
    return true;
  });

  return (
    tool({
      description:
        "Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title and kind.",
      inputSchema: z.object({
        title: z.string(),
        kind: z
        .enum(allowedArtifactKinds as any)
        .describe(
          `The type of document to create. ${!imageGenerationEnabled ? "Note: 'image' type is not available when image generation is disabled." : ""}`
        ),
      }),
      execute: async ({ title, kind }) => {
        // Double-check that image kind is not used when disabled
        if (kind === "image" && !imageGenerationEnabled) {
          return {
            error: "Image generation is currently disabled. Please enable it in the tools settings to create images.",
            suggestion: "You can enable image generation in the settings menu.",
          };
        }
        const id = generateUUID();
  
        dataStream.write({
          type: "data-kind",
          data: kind,
          transient: true,
        });
  
        dataStream.write({
          type: "data-id",
          data: id,
          transient: true,
        });
  
        dataStream.write({
          type: "data-title",
          data: title,
          transient: true,
        });
  
        dataStream.write({
          type: "data-clear",
          data: null,
          transient: true,
        });
  
        const documentHandler = documentHandlersByArtifactKind.find(
          (documentHandlerByArtifactKind) =>
            documentHandlerByArtifactKind.kind === kind
        );
  
        if (!documentHandler) {
          throw new Error(`No document handler found for kind: ${kind}`);
        }
  
        await documentHandler.onCreateDocument({
          id,
          title,
          dataStream,
          userId,
        });
  
        dataStream.write({ type: "data-finish", data: null, transient: true });
  
        return {
          id,
          title,
          kind,
          content: "A document was created and is now visible to the user.",
        };
      },
    })
  )
}
