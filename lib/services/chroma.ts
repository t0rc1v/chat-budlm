// lib/services/chroma.ts (updated with enhanced features)
import { CloudClient } from "chromadb";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PDFParse } from 'pdf-parse';
import mammoth from "mammoth";
import { createWorker, PSM } from "tesseract.js";
import { createHash } from "crypto";
import { generateText } from "ai";
import { PDFDocument } from 'pdf-lib';
import { google } from '@ai-sdk/google';

const client = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY!,
  tenant: process.env.CHROMA_TENANT!,
  database: process.env.CHROMA_DATABASE || 'chat-budlm'
});

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "text-embedding-3-small",
});

// Cache for embeddings to optimize costs
const embeddingCache = new Map<string, number[]>();

function getCacheKey(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

// Enhanced PDF processing with better OCR detection
async function processPDF(buffer: Buffer): Promise<{
  text: string;
  metadata: { pageCount: number; isScanned: boolean };
}> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const parser = new PDFParse({ data: uint8Array });
    const result = await parser.getText();
    
    const pageCount = result.total || 0;
    const text = result.text;
    
    // Check if PDF has selectable text (at least 100 chars per page average)
    const hasText = text && text.trim().length > (pageCount * 100);
    
    if (hasText) {
      return {
        text,
        metadata: { pageCount, isScanned: false },
      };
    }
    
    // If no text or insufficient text, it's likely scanned - use enhanced OCR
    console.log("PDF appears to be scanned, using enhanced OCR...");
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(arrayBuffer);
    view.set(buffer);
    const ocrText = await extractTextWithGemini(arrayBuffer);
    
    return {
      text: ocrText,
      metadata: { pageCount, isScanned: true },
    };
  } catch (error) {
    console.error("Error processing PDF:", error);
    throw new Error("Failed to process PDF");
  }
}

async function extractTextWithGemini(buffer: ArrayBuffer): Promise<string> {
  console.log('Using Gemini 2.5 Flash for OCR extraction...');
  
  const PAGES_PER_CHUNK = 15; // Optimal chunk size for balance between speed and reliability
  
  try {
    // Load the PDF to get page count
    const pdfDoc = await PDFDocument.load(buffer);
    const totalPages = pdfDoc.getPageCount();
    
    console.log(`PDF has ${totalPages} pages`);
    
    // If PDF is small enough, process it directly
    if (totalPages <= PAGES_PER_CHUNK) {
      return await processChunk(buffer, 1, totalPages, totalPages);
    }
    
    // Split into chunks and process in parallel
    const chunks: Promise<string>[] = [];
    
    for (let startPage = 0; startPage < totalPages; startPage += PAGES_PER_CHUNK) {
      const endPage = Math.min(startPage + PAGES_PER_CHUNK, totalPages);
      
      // Create a new PDF with only the chunk pages
      const chunkDoc = await PDFDocument.create();
      const copiedPages = await chunkDoc.copyPages(
        pdfDoc, 
        Array.from({ length: endPage - startPage }, (_, i) => startPage + i)
      );
      
      copiedPages.forEach(page => chunkDoc.addPage(page));
      
      const chunkBytes = await chunkDoc.save();
      
      // Convert Uint8Array to ArrayBuffer explicitly
      const chunkBuffer = new ArrayBuffer(chunkBytes.length);
      const view = new Uint8Array(chunkBuffer);
      view.set(chunkBytes);
      
      // Process chunk (with rate limiting consideration)
      chunks.push(
        processChunk(
          chunkBuffer, 
          startPage + 1, 
          endPage, 
          totalPages
        )
      );
      
      // Add small delay between chunk submissions to avoid rate limits
      if (startPage + PAGES_PER_CHUNK < totalPages) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Wait for all chunks to complete
    console.log(`Processing ${chunks.length} chunks in parallel...`);
    const results = await Promise.all(chunks);
    
    // Merge results
    const finalText = results.join('\n\n');
    console.log(`Total extracted: ${finalText.length} characters from ${totalPages} pages`);
    
    return finalText;
    
  } catch (error: any) {
    console.error('Error in chunked PDF processing:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

async function processChunk(
  buffer: ArrayBuffer, 
  startPage: number, 
  endPage: number, 
  totalPages: number
): Promise<string> {
  console.log(`Processing pages ${startPage}-${endPage} of ${totalPages}...`);
  
  // Convert ArrayBuffer to base64
  const uint8Array = new Uint8Array(buffer);
  const base64 = Buffer.from(uint8Array).toString('base64');
  
  const { text, usage } = await generateText({
    model: google('gemini-2.5-flash-lite'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract all text from this PDF (pages ${startPage}-${endPage}). Return only the raw text content, no formatting or explanations.`
          },
          {
            type: 'file',
            data: base64,
            mediaType: 'application/pdf'
          }
        ]
      }
    ],
    temperature: 0,
  });

  console.log(`Pages ${startPage}-${endPage}`)
  console.log('Token usage:', usage)
  
  if (!text || text.trim().length === 0) {
    console.warn(`No text extracted from pages ${startPage}-${endPage}`);
    return '';
  }
  
  console.log(`Extracted ${text.length} characters from pages ${startPage}-${endPage}`);
  return text;
}

// Enhanced OCR with preprocessing
async function processScannedPDF(buffer: Buffer): Promise<string> {
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  
  try {
    // Set OCR parameters for better accuracy
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO_OSD, // Automatic page segmentation with OSD
      preserve_interword_spaces: '1',
    });

    const { data: { text } } = await worker.recognize(buffer);
    
    // Post-process OCR text
    return cleanOCRText(text);
  } finally {
    await worker.terminate();
  }
}

// Clean up OCR artifacts
function cleanOCRText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\S\r\n]+/g, ' ') // Remove extra spaces
    .replace(/(\r\n|\n|\r){3,}/g, '\n\n') // Normalize line breaks
    .trim();
}

async function processDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function processTXT(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8");
}

async function processDocument(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; metadata?: any }> {
  switch (mimeType) {
    case "application/pdf":
      return await processPDF(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/msword":
      return { text: await processDOCX(buffer) };
    case "text/plain":
    case "text/markdown":
    case "text/csv":
      return { text: await processTXT(buffer) };
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

// Split text into chunks
async function splitText(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  
  return await splitter.splitText(text);
}

// Create embeddings with caching
async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  const textsToEmbed: string[] = [];
  const indices: number[] = [];

  // Check cache first
  texts.forEach((text, index) => {
    const cacheKey = getCacheKey(text);
    const cached = embeddingCache.get(cacheKey);
    
    if (cached) {
      results[index] = cached;
    } else {
      textsToEmbed.push(text);
      indices.push(index);
    }
  });

  // Embed uncached texts
  if (textsToEmbed.length > 0) {
    const newEmbeddings = await embeddings.embedDocuments(textsToEmbed);
    
    newEmbeddings.forEach((embedding, i) => {
      const originalIndex = indices[i];
      results[originalIndex] = embedding;
      
      // Cache the embedding
      const cacheKey = getCacheKey(textsToEmbed[i]);
      embeddingCache.set(cacheKey, embedding);
    });
  }

  return results;
}

// Main function to process and store document
export async function processAndStoreDocument({
  fileId,
  projectId,
  fileName,
  fileUrl,
  mimeType,
}: {
  fileId: string;
  projectId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
}): Promise<{ collectionId: string; embeddingCount: number; metadata?: any }> {
  try {
    // Download file
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Process document based on type
    const { text, metadata } = await processDocument(buffer, mimeType);
    
    if (!text || text.trim().length === 0) {
      throw new Error("No text extracted from document");
    }
    
    // Split into chunks
    const chunks = await splitText(text);
    
    // Create embeddings with caching
    const embeddingVectors = await createEmbeddings(chunks);
    
    // Create or get collection
    const collectionName = `project_${projectId}`;
    const collection = await client.getOrCreateCollection({
      name: collectionName,
    });
    
    // Store in ChromaDB
    const ids = chunks.map((_, i) => `${fileId}_chunk_${i}`);
    const metadatas = chunks.map((chunk, i) => ({
      fileId,
      fileName,
      chunkIndex: i,
      totalChunks: chunks.length,
      ...metadata,
    }));
    
    await collection.add({
      ids,
      embeddings: embeddingVectors,
      documents: chunks,
      metadatas,
    });
    
    return {
      collectionId: collectionName,
      embeddingCount: chunks.length,
      metadata,
    };
  } catch (error) {
    console.error("Error processing document:", error);
    throw error;
  }
}

// Query documents with RAG
export async function queryDocuments({
  projectId,
  query,
  fileIds,
  nResults = 5,
}: {
  projectId: string;
  query: string;
  fileIds: string[];
  nResults?: number;
}): Promise<{
  documents: string[];
  metadatas: any[];
  distances: number[];
}> {
  try {
    const collectionName = `project_${projectId}`;
    const collection = await client.getCollection({ name: collectionName });
    
    // Check cache for query embedding
    const cacheKey = getCacheKey(query);
    let queryEmbedding = embeddingCache.get(cacheKey);
    
    if (!queryEmbedding) {
      [queryEmbedding] = await embeddings.embedDocuments([query]);
      embeddingCache.set(cacheKey, queryEmbedding);
    }
    
    // Build where clause for file filtering
    const whereClause = fileIds.length > 0 ? { fileId: { $in: fileIds } } : undefined;
    
    // Query collection
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
      where: whereClause,
    });
    
    return {
      documents: (results.documents[0] || []).filter((doc): doc is string => doc !== null),
      metadatas: (results.metadatas[0] || []).filter(meta => meta !== null),
      distances: (results.distances?.[0] || []).filter((dist): dist is number => dist !== null),
    };
  } catch (error) {
    console.error("Error querying documents:", error);
    return { documents: [], metadatas: [], distances: [] };
  }
}

// Get file chunks for preview
export async function getFileChunks({
  projectId,
  fileId,
}: {
  projectId: string;
  fileId: string;
}): Promise<Array<{ document: string; metadata: any }>> {
  try {
    const collectionName = `project_${projectId}`;
    const collection = await client.getCollection({ name: collectionName });
    
    const results = await collection.get({
      where: { fileId },
    });
    
    return results.documents.map((doc, i) => ({
      document: doc || "",
      metadata: results.metadatas[i],
    }));
  } catch (error) {
    console.error("Error getting file chunks:", error);
    return [];
  }
}

// Delete file from collection
export async function deleteFileFromCollection({
  projectId,
  fileId,
}: {
  projectId: string;
  fileId: string;
}): Promise<void> {
  try {
    const collectionName = `project_${projectId}`;
    const collection = await client.getCollection({ name: collectionName });
    
    const results = await collection.get({
      where: { fileId },
    });
    
    if (results.ids.length > 0) {
      await collection.delete({ ids: results.ids });
      
      // Clear cache entries for this file
      results.documents.forEach(doc => {
        if (doc) {
          const cacheKey = getCacheKey(doc);
          embeddingCache.delete(cacheKey);
        }
      });
    }
  } catch (error) {
    console.error("Error deleting file from collection:", error);
  }
}

// Delete entire collection
export async function deleteCollection(projectId: string): Promise<void> {
  try {
    const collectionName = `project_${projectId}`;
    await client.deleteCollection({ name: collectionName });
  } catch (error) {
    console.error("Error deleting collection:", error);
  }
}

// Validate file type
export function isValidDocumentType(mimeType: string): boolean {
  const validTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/markdown",
    "text/csv",
  ];
  
  return validTypes.includes(mimeType);
}

// https://claude.ai/chat/d3c87a72-2cbd-45f2-b71d-385b25734e33