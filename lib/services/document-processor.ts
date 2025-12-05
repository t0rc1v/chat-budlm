// lib/services/document-processor.ts
import { updateFileEmbeddingStatus, updateFileMetadata } from "../db/project-queries";
import { processAndStoreDocument, isValidDocumentType } from "./chroma";

export async function processDocument({
  fileId,
  fileName,
  fileUrl,
  fileType,
}: {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
}) {
  try {
    // Validate file type
    if (!isValidDocumentType(fileType)) {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Update status to processing
    await updateFileEmbeddingStatus({
      id: fileId,
      status: "processing",
    });

    // Process and store in ChromaDB
    const result = await processAndStoreDocument({
      fileId,
      fileName,
      fileUrl,
      mimeType: fileType,
    });

    console.log("result metadata", result.metadata)

    // Update metadata with processing results
    if (result.metadata) {
      await updateFileMetadata({
        id: fileId,
        metadata: result.metadata,
      });
    }

    // Update status to completed
    await updateFileEmbeddingStatus({
      id: fileId,
      status: "completed",
      chromaCollectionId: result.collectionId,
    });

    console.log(`Successfully processed ${fileName}:`, {
      chunks: result.embeddingCount,
      isScanned: result.metadata?.isScanned,
      pageCount: result.metadata?.pageCount,
    });
    
    return {
      success: true,
      chunksProcessed: result.embeddingCount,
      metadata: result.metadata,
    };
  } catch (error) {
    console.error("Error processing document:", error);
    
    // Update status to failed
    await updateFileEmbeddingStatus({
      id: fileId,
      status: "failed",
    });
    
    throw error;
  }
}