// lib/services/chroma.ts
import { CloudClient } from "chromadb";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PDFParse } from 'pdf-parse';
import mammoth from "mammoth";
import { createHash } from "crypto";
import { generateText } from "ai";
import { PDFDocument } from 'pdf-lib';
import { google } from '@ai-sdk/google';
import { Mistral } from '@mistralai/mistralai';
import Papa from 'papaparse';

const client = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY!,
  tenant: process.env.CHROMA_TENANT!,
  database: process.env.CHROMA_DATABASE || 'chat-budlm'
});

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "text-embedding-3-small",
});

const mistralClient = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY!,
});

// Cache for embeddings to optimize costs
const embeddingCache = new Map<string, number[]>();

function getCacheKey(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

// Detect the type of query to apply appropriate retrieval strategy
function detectQueryType(query: string): 'overview' | 'explanation' | 'specific' {
  const lowerQuery = query.toLowerCase();
  
  const overviewKeywords = [
    'overview', 'summary', 'summarize', 'chapter', 
    'introduction', 'introduce', 'what is covered',
    'main topics', 'key concepts', 'outline'
  ];
  
  const explanationKeywords = [
    'explain', 'describe', 'what is', 'how does',
    'define', 'tell me about', 'elaborate'
  ];

  if (overviewKeywords.some(kw => lowerQuery.includes(kw))) {
    return 'overview';
  }
  
  if (explanationKeywords.some(kw => lowerQuery.includes(kw))) {
    return 'explanation';
  }
  
  return 'specific';
}

// Enhanced PDF processing with better OCR detection
async function processPDF(buffer: Buffer): Promise<{
  text: string;
  metadata: { pageCount: number; isScanned: boolean; ocrEngine?: string };
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
      // Convert plain text to markdown format with paragraphs
      const formattedText = text
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .join('\n\n');
      
      return {
        text: formattedText,
        metadata: { pageCount, isScanned: false },
      };
    }
    
    // If no text or insufficient text, it's likely scanned - use enhanced OCR
    console.log("PDF appears to be scanned, using enhanced OCR...");
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(arrayBuffer);
    view.set(buffer);

    // Try Mistral OCR first (faster and more cost-effective)
    try {
      const ocrText = await extractTextWithMistral(arrayBuffer);
      return {
        text: ocrText,
        metadata: { pageCount, isScanned: true, ocrEngine: 'mistral' },
      };
    } catch (mistralError) {
      console.warn('Mistral OCR failed, falling back to Gemini:', mistralError);
      // Fallback to Gemini if Mistral fails
      const ocrText = await extractTextWithGemini(arrayBuffer);
      return {
        text: ocrText,
        metadata: { pageCount, isScanned: true, ocrEngine: 'gemini' },
      };
    }
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
    model: google('gemini-2.5-flash'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract all text from this PDF (pages ${startPage}-${endPage}). Format the output in markdown with proper headings, paragraphs, lists, and tables where appropriate. Preserve the document structure.`
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

async function extractTextWithMistral(buffer: ArrayBuffer): Promise<string> {
  console.log('Using Mistral OCR for text extraction...');
  
  try {
    // Convert ArrayBuffer to base64
    const uint8Array = new Uint8Array(buffer);
    const base64 = Buffer.from(uint8Array).toString('base64');
    
    // Process with Mistral OCR using data URI format
    const ocrResponse = await mistralClient.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        documentUrl: `data:application/pdf;base64,${base64}`,
      },
      includeImageBase64: false, // Set to true if you need embedded images
    });
    
    // Extract text from all pages
    let fullText = '';
    
    if (ocrResponse.pages && Array.isArray(ocrResponse.pages)) {
      for (const page of ocrResponse.pages) {
        if (page.markdown) {
          fullText += page.markdown + '\n\n';
        }
      }
    }
    
    if (!fullText || fullText.trim().length === 0) {
      throw new Error('No text extracted from PDF using Mistral OCR');
    }
    
    console.log(`Mistral OCR extracted ${fullText.length} characters`);
    console.log('Usage info:', ocrResponse.usageInfo);
    
    return fullText.trim();
    
  } catch (error: any) {
    console.error('Error in Mistral OCR processing:', error);
    throw new Error(`Failed to extract text with Mistral OCR: ${error.message}`);
  }
}

async function processDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function processTXT(buffer: Buffer): Promise<string> {
  const text = buffer.toString("utf-8");
  
  // Convert plain text to markdown with basic formatting
  // Split into paragraphs and add proper spacing
  const paragraphs = text
    .split(/\n\s*\n/) // Split on double newlines
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  return paragraphs.join('\n\n');
}

async function processCSV(buffer: Buffer): Promise<string> {
  const csvText = buffer.toString("utf-8");
  
  // Parse CSV using PapaParse with proper typing
  const parseResult = Papa.parse<Record<string, any>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  
  if (parseResult.errors.length > 0) {
    console.warn('CSV parsing errors:', parseResult.errors);
  }
  
  const data = parseResult.data;
  
  if (!data || data.length === 0 || !data[0]) {
    return csvText; // Return raw if parsing fails
  }
  
  // Convert to markdown table
  const headers = Object.keys(data[0]);
  
  if (headers.length === 0) {
    return csvText; // Return raw if no headers
  }
  
  // Create header row
  let markdown = '| ' + headers.join(' | ') + ' |\n';
  
  // Create separator row
  markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
  
  // Create data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape pipes and handle null/undefined
      return value != null ? String(value).replace(/\|/g, '\\|') : '';
    });
    markdown += '| ' + values.join(' | ') + ' |\n';
  }
  
  return markdown;
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
      return { text: await processTXT(buffer) };
    case "text/csv":
      return { text: await processCSV(buffer) };
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
  projectId: string | null;
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
    const collectionName = fileId;
    const collection = await client.getOrCreateCollection({
      name: collectionName,
    });
    
    // Store in ChromaDB
    const ids = chunks.map((_, i) => `${fileId}_chunk_${i}`);
    const metadatas = chunks.map((chunk, i) => ({
      fileId,
      fileName,
      projectId,
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

// Updated queryDocuments to query from multiple file collections
export async function queryDocuments({
  projectId,
  query,
  fileIds,
  nResults = 5,
  rerankResults = true,
  diversityThreshold = 0.7,
  enableSmartRetrieval = true,
}: {
  projectId: string;
  query: string;
  fileIds: string[];
  nResults?: number;
  rerankResults?: boolean;
  diversityThreshold?: number;
  enableSmartRetrieval?: boolean;
}): Promise<{
  documents: string[];
  metadatas: any[];
  distances: number[];
  totalChunks: number;
  filesQueried: string[];
}> {
  try {
    // If no fileIds provided, return empty results
    if (fileIds.length === 0) {
      console.warn('No fileIds provided for query');
      return {
        documents: [],
        metadatas: [],
        distances: [],
        totalChunks: 0,
        filesQueried: [],
      };
    }
    
    // Detect query type for smart retrieval
    const queryType = detectQueryType(query);
    
    // Check cache for query embedding
    const cacheKey = getCacheKey(query);
    let queryEmbedding = embeddingCache.get(cacheKey);
    
    if (!queryEmbedding) {
      [queryEmbedding] = await embeddings.embedDocuments([query]);
      embeddingCache.set(cacheKey, queryEmbedding);
    }
    
    // Calculate results per file
    const resultsPerFile = Math.ceil(nResults / fileIds.length);
    const initialNResults = rerankResults ? resultsPerFile * 3 : resultsPerFile;
    
    // Query each collection (file) in parallel
    const collectionQueries = fileIds.map(async (fileId) => {
      try {
        const collection = await client.getCollection({ name: fileId });
        
        // Use smart retrieval for overview queries if enabled
        if (enableSmartRetrieval && queryType === 'overview') {
          return await retrieveOverviewContextForFile({
            collection,
            fileId,
            query,
            queryEmbedding,
            nResults: resultsPerFile,
            rerankResults: false, // We'll rerank globally later
          });
        }
        
        // Standard retrieval
        const results = await collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: initialNResults,
        });
        
        return {
          fileId,
          documents: (results.documents[0] || []).filter((doc): doc is string => doc !== null),
          metadatas: (results.metadatas[0] || []).filter(meta => meta !== null),
          distances: (results.distances?.[0] || []).filter((dist): dist is number => dist !== null),
        };
      } catch (error) {
        console.warn(`Failed to query collection ${fileId}:`, error);
        return {
          fileId,
          documents: [],
          metadatas: [],
          distances: [],
        };
      }
    });
    
    // Wait for all collection queries to complete
    const allResults = await Promise.all(collectionQueries);
    
    // Merge and sort results from all collections
    const combined = allResults.flatMap(result =>
      result.documents.map((doc, i) => ({
        document: doc,
        metadata: result.metadatas[i],
        distance: result.distances[i],
        fileId: result.fileId,
      }))
    );
    
    // Sort by distance (lower is better)
    combined.sort((a, b) => a.distance - b.distance);
    
    let documents = combined.map(c => c.document);
    let metadatas = combined.map(c => c.metadata);
    let distances = combined.map(c => c.distance);
    
    const totalChunks = documents.length;
    const filesQueried = allResults
      .filter(r => r.documents.length > 0)
      .map(r => r.fileId);
    
    // Apply diversity filtering
    if (documents.length > nResults) {
      const diverseResults = applyDiversityFilter({
        documents,
        metadatas,
        distances,
        threshold: diversityThreshold,
        maxResults: nResults,
      });
      
      documents = diverseResults.documents;
      metadatas = diverseResults.metadatas;
      distances = diverseResults.distances;
    }
    
    // Optional global reranking
    if (rerankResults && documents.length > 0) {
      const reranked = await rerankByRelevance({
        query,
        documents,
        metadatas,
        distances,
        topK: nResults,
      });
      
      documents = reranked.documents;
      metadatas = reranked.metadatas;
      distances = reranked.distances;
    }
    
    console.log(`Retrieved ${documents.length} chunks for ${queryType} query from ${filesQueried.length} files`);
    
    return {
      documents,
      metadatas,
      distances,
      totalChunks,
      filesQueried,
    };
  } catch (error) {
    console.error("Error querying documents:", error);
    return {
      documents: [],
      metadatas: [],
      distances: [],
      totalChunks: 0,
      filesQueried: [],
    };
  }
}

// Helper function for overview retrieval from a single file collection
async function retrieveOverviewContextForFile({
  collection,
  fileId,
  query,
  queryEmbedding,
  nResults,
  rerankResults,
}: {
  collection: any;
  fileId: string;
  query: string;
  queryEmbedding: number[];
  nResults: number;
  rerankResults: boolean;
}): Promise<{
  fileId: string;
  documents: string[];
  metadatas: any[];
  distances: number[];
}> {
  try {
    // Strategy 1: Get semantically relevant chunks (60% of budget)
    const semanticBudget = Math.floor(nResults * 0.6);
    
    const semanticResults = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: semanticBudget,
    });

    // Strategy 2: Get structural chunks (40% of budget)
    const structuralQueries = [
      "introduction objectives learning outcomes",
      "key concepts main topics definitions",
    ];

    const structuralBudget = Math.floor(nResults * 0.4);
    const structuralResults = await Promise.all(
      structuralQueries.map(async (structQuery) => {
        const cacheKey = getCacheKey(structQuery);
        let structEmb = embeddingCache.get(cacheKey);
        
        if (!structEmb) {
          [structEmb] = await embeddings.embedDocuments([structQuery]);
          embeddingCache.set(cacheKey, structEmb);
        }
        
        return collection.query({
          queryEmbeddings: [structEmb],
          nResults: Math.floor(structuralBudget / structuralQueries.length),
        });
      })
    );

    // Combine results, removing duplicates
    const allIds = new Set<string>();
    const allDocuments: string[] = [];
    const allMetadatas: any[] = [];
    const allDistances: number[] = [];

    const addResults = (results: any, baseScore: number = 0) => {
      if (results?.documents?.[0]) {
        results.documents[0].forEach((doc: string, idx: number) => {
          const id = results.ids?.[0]?.[idx];
          if (id && !allIds.has(id)) {
            allIds.add(id);
            allDocuments.push(doc);
            allMetadatas.push(results.metadatas?.[0]?.[idx] || {});
            allDistances.push((results.distances?.[0]?.[idx] ?? 1) + baseScore);
          }
        });
      }
    };

    // Add semantic results (highest priority)
    addResults(semanticResults, 0);

    // Add structural results (medium priority)
    structuralResults.forEach((result) => {
      addResults(result, 0.1);
    });

    // Sort by relevance
    const indexed = allDocuments.map((doc, i) => ({
      doc,
      metadata: allMetadatas[i],
      distance: allDistances[i],
      chunkIndex: allMetadatas[i]?.chunkIndex ?? 999999
    }));

    indexed.sort((a, b) => {
      const scoreDiff = a.distance - b.distance;
      if (Math.abs(scoreDiff) > 0.2) {
        return scoreDiff;
      }
      return a.chunkIndex - b.chunkIndex;
    });

    const limited = indexed.slice(0, nResults);

    return {
      fileId,
      documents: limited.map(r => r.doc),
      metadatas: limited.map(r => r.metadata),
      distances: limited.map(r => r.distance),
    };

  } catch (error) {
    console.error(`Error in overview retrieval for file ${fileId}:`, error);
    // Fallback to standard retrieval
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
    });
    
    return {
      fileId,
      documents: (results.documents[0] || []).filter((doc: string): doc is string => doc !== null),
      metadatas: (results.metadatas[0] || []).filter((meta: any) => meta !== null),
      distances: (results.distances?.[0] || []).filter((dist: number): dist is number => dist !== null),
    };
  }
}

/**
 * Multi-strategy retrieval for overview queries (from version 1)
 * Combines semantic search with structural chunk retrieval
 */
async function retrieveOverviewContext({
  collection,
  query,
  queryEmbedding,
  whereClause,
  nResults,
  rerankResults,
}: {
  collection: any;
  query: string;
  queryEmbedding: number[];
  whereClause: any;
  nResults: number;
  rerankResults: boolean;
}): Promise<{
  documents: string[];
  metadatas: any[];
  distances: number[];
  totalChunks: number;
  filesQueried: string[];
}> {
  try {
    console.log('Using multi-strategy retrieval for overview query...');
    
    // Strategy 1: Get semantically relevant chunks (60% of budget)
    const semanticBudget = Math.floor(nResults * 0.6);
    
    const semanticResults = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: semanticBudget,
      where: whereClause,
    });

    // Strategy 2: Get structural chunks (headers, objectives, intro)
    const structuralQueries = [
      "chapter introduction objectives learning outcomes",
      "key concepts main topics definitions",
      "summary relationships formulas identities"
    ];

    const structuralBudget = Math.floor(nResults * 0.25);
    const structuralResults = await Promise.all(
      structuralQueries.map(async (structQuery) => {
        const cacheKey = getCacheKey(structQuery);
        let structEmb = embeddingCache.get(cacheKey);
        
        if (!structEmb) {
          [structEmb] = await embeddings.embedDocuments([structQuery]);
          embeddingCache.set(cacheKey, structEmb);
        }
        
        return collection.query({
          queryEmbeddings: [structEmb],
          nResults: Math.floor(structuralBudget / structuralQueries.length),
          where: whereClause,
        });
      })
    );

    // Strategy 3: Get first chunks for context (15% of budget)
    const boundaryBudget = Math.floor(nResults * 0.15);
    
    const firstChunks = await collection.get({
      where: whereClause,
      limit: boundaryBudget,
    });

    // Combine all results, removing duplicates
    const allIds = new Set<string>();
    const allDocuments: string[] = [];
    const allMetadatas: any[] = [];
    const allDistances: number[] = [];

    const addResults = (results: any, baseScore: number = 0) => {
      if (results?.documents?.[0]) {
        results.documents[0].forEach((doc: string, idx: number) => {
          const id = results.ids?.[0]?.[idx];
          if (id && !allIds.has(id)) {
            allIds.add(id);
            allDocuments.push(doc);
            allMetadatas.push(results.metadatas?.[0]?.[idx] || {});
            allDistances.push((results.distances?.[0]?.[idx] ?? 1) + baseScore);
          }
        });
      }
    };

    // Add semantic results (highest priority)
    addResults(semanticResults, 0);

    // Add structural results (medium priority)
    structuralResults.forEach((result) => {
      addResults(result, 0.1);
    });

    // Add first chunks (lower priority)
    if (firstChunks?.documents) {
      const firstChunksFormatted = {
        documents: [firstChunks.documents],
        ids: [firstChunks.ids],
        metadatas: [firstChunks.metadatas],
        distances: [firstChunks.documents.map(() => 0.3)]
      };
      addResults(firstChunksFormatted, 0.3);
    }

    // Sort by relevance, then by position
    const indexedResults = allDocuments.map((doc, i) => ({
      doc,
      id: Array.from(allIds)[i],
      metadata: allMetadatas[i],
      distance: allDistances[i],
      chunkIndex: allMetadatas[i]?.chunkIndex ?? 999999
    }));

    indexedResults.sort((a, b) => {
      const scoreDiff = a.distance - b.distance;
      if (Math.abs(scoreDiff) > 0.2) {
        return scoreDiff;
      }
      return a.chunkIndex - b.chunkIndex;
    });

    // Limit to nResults
    const limitedResults = indexedResults.slice(0, nResults);
    
    let documents = limitedResults.map(r => r.doc);
    let metadatas = limitedResults.map(r => r.metadata);
    let distances = limitedResults.map(r => r.distance);
    
    const filesQueried = [...new Set(
      metadatas
        .map(m => m?.fileId)
        .filter((fileId): fileId is string => typeof fileId === 'string')
    )];

    // Optional reranking for overview queries
    if (rerankResults && documents.length > 0) {
      const reranked = await rerankByRelevance({
        query,
        documents,
        metadatas,
        distances,
        topK: nResults,
      });
      
      documents = reranked.documents;
      metadatas = reranked.metadatas;
      distances = reranked.distances;
    }

    console.log(`Overview retrieval: ${semanticResults.documents?.[0]?.length || 0} semantic + ${structuralResults.reduce((sum, r) => sum + (r.documents?.[0]?.length || 0), 0)} structural + ${firstChunks?.documents?.length || 0} boundary = ${limitedResults.length} total chunks`);

    return {
      documents,
      metadatas,
      distances,
      totalChunks: allDocuments.length,
      filesQueried,
    };

  } catch (error) {
    console.error('Error in overview retrieval, falling back to standard:', error);
    // Fallback to standard retrieval
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
      where: whereClause,
    });
    
    return {
      documents: (results.documents[0] || []).filter((doc: string): doc is string => doc !== null),
      metadatas: (results.metadatas[0] || []).filter((meta: any) => meta !== null),
      distances: (results.distances?.[0] || []).filter((dist: number): dist is number => dist !== null),
      totalChunks: results.documents[0]?.length || 0,
      filesQueried: [],
    };
  }
}

// Apply diversity filter to avoid returning similar chunks
function applyDiversityFilter({
  documents,
  metadatas,
  distances,
  threshold,
  maxResults,
}: {
  documents: string[];
  metadatas: any[];
  distances: number[];
  threshold: number;
  maxResults: number;
}): {
  documents: string[];
  metadatas: any[];
  distances: number[];
} {
  const selected: number[] = [];
  
  for (let i = 0; i < documents.length && selected.length < maxResults; i++) {
    const currentDoc = documents[i];
    let isDiverse = true;
    
    for (const selectedIdx of selected) {
      const similarity = calculateSimilarity(currentDoc, documents[selectedIdx]);
      if (similarity > threshold) {
        isDiverse = false;
        break;
      }
    }
    
    if (isDiverse) {
      selected.push(i);
    }
  }
  
  return {
    documents: selected.map(i => documents[i]),
    metadatas: selected.map(i => metadatas[i]),
    distances: selected.map(i => distances[i]),
  };
}

// Simple Jaccard similarity for diversity filtering
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Rerank results using a simple scoring mechanism
async function rerankByRelevance({
  query,
  documents,
  metadatas,
  distances,
  topK,
}: {
  query: string;
  documents: string[];
  metadatas: any[];
  distances: number[];
  topK: number;
}): Promise<{
  documents: string[];
  metadatas: any[];
  distances: number[];
}> {
  const queryTerms = query.toLowerCase().split(/\s+/);
  
  const scored = documents.map((doc, i) => {
    const docLower = doc.toLowerCase();
    
    const keywordMatches = queryTerms.filter(term => docLower.includes(term)).length;
    const keywordScore = keywordMatches / queryTerms.length;
    
    const semanticScore = 1 - (distances[i] || 0);
    
    const positionScore = metadatas[i]?.chunkIndex 
      ? 1 - (metadatas[i].chunkIndex / (metadatas[i].totalChunks || 1)) * 0.1
      : 1;
    
    const finalScore = 
      semanticScore * 0.6 + 
      keywordScore * 0.3 + 
      positionScore * 0.1;
    
    return {
      document: doc,
      metadata: metadatas[i],
      distance: distances[i],
      score: finalScore,
      index: i,
    };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  const topResults = scored.slice(0, topK);
  
  return {
    documents: topResults.map(r => r.document),
    metadatas: topResults.map(r => r.metadata),
    distances: topResults.map(r => r.distance),
  };
}

// Enhanced query with multi-query retrieval
export async function queryDocumentsWithMultiQuery({
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
  // Generate multiple query variations for better retrieval
  const queryVariations = generateQueryVariations(query);
  
  const allResults = await Promise.all(
    queryVariations.map(q => 
      queryDocuments({
        projectId,
        query: q,
        fileIds,
        nResults: Math.ceil(nResults / 2),
        rerankResults: false,
      })
    )
  );
  
  // Merge and deduplicate results
  const mergedDocs = new Map<string, { doc: string; meta: any; dist: number }>();
  
  allResults.forEach(result => {
    result.documents.forEach((doc, i) => {
      const key = getCacheKey(doc);
      if (!mergedDocs.has(key) || mergedDocs.get(key)!.dist > result.distances[i]) {
        mergedDocs.set(key, {
          doc,
          meta: result.metadatas[i],
          dist: result.distances[i],
        });
      }
    });
  });
  
  // Sort by distance and take top N
  const sorted = Array.from(mergedDocs.values())
    .sort((a, b) => a.dist - b.dist)
    .slice(0, nResults);
  
  return {
    documents: sorted.map(r => r.doc),
    metadatas: sorted.map(r => r.meta),
    distances: sorted.map(r => r.dist),
  };
}

// Generate query variations for multi-query retrieval
function generateQueryVariations(query: string): string[] {
  const variations = [query];
  
  // Add question form if not already a question
  if (!query.includes('?')) {
    variations.push(`What ${query}?`);
    variations.push(`How ${query}?`);
  }
  
  // Add keyword extraction (remove filler words)
  const fillerWords = new Set(['what', 'how', 'why', 'when', 'where', 'is', 'are', 'the', 'a', 'an']);
  const keywords = query.toLowerCase()
    .split(/\s+/)
    .filter(word => !fillerWords.has(word) && word.length > 2)
    .join(' ');
  
  if (keywords !== query) {
    variations.push(keywords);
  }
  
  return [...new Set(variations)];
}

// Get file chunks for preview
// Updated getFileChunks to query from file collection
export async function getFileChunks({
  projectId,
  fileId,
}: {
  projectId: string;
  fileId: string;
}): Promise<Array<{ document: string; metadata: any }>> {
  try {
    const collection = await client.getCollection({ name: fileId });
    
    const results = await collection.get();
    
    return results.documents.map((doc, i) => ({
      document: doc || "",
      metadata: results.metadatas[i],
    }));
  } catch (error) {
    console.error("Error getting file chunks:", error);
    return [];
  }
}

// Updated deleteFileFromCollection to delete the entire collection
export async function deleteFileCollection({
  fileId,
}: {
  fileId: string;
}): Promise<void> {
  try {
    // Delete the collection named after the fileId
    await client.deleteCollection({ name: fileId });
    
    // Clear cache entries for this file (optional, but good for memory management)
    // Note: This requires iterating through cache, which may not be efficient
    // Consider implementing cache cleanup differently if performance is an issue
  } catch (error) {
    console.error(`Error deleting collection for file ${fileId}:`, error);
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