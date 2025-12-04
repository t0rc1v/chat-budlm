// api/chat/route.ts version 2 - Enhanced with smart retrieval from version 1
import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import type { VisibilityType } from "@/components/visibility-selector";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { type RequestHints, systemPromptWithRAG } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getUserType,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { type PostRequestBody, postRequestBodySchema } from "./schema";
import { auth } from "@clerk/nextjs/server";
import { UserType } from "@/types";
import { generateTitleFromUserMessage } from "@/app/(chat)/actions";
import { queryDocuments } from "@/lib/services/chroma";
import { buildRAGContext } from "@/lib/ai/prompts";
import { getSelectedFileIds } from "@/lib/db/file-queries";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return; // tokenlens helpers will fall back to defaultCatalog
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      projectId,
      selectedFileIds,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
      projectId?: string | null;
      selectedFileIds?: string[];
    } = requestBody;

    console.log("selectedFileIds", selectedFileIds, selectedFileIds?.length)

    const {userId} = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = await getUserType(userId);

    const messageCount = await getMessageCountByUserId({
      id: userId,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];

    // ========================================================================
    // ENHANCED RAG: Get context from selected files with smart retrieval
    // ========================================================================
    let ragContext = "";
    let fileIdsToQuery: string[] = [];
    let ragMetrics = {
      documentsRetrieved: 0,
      filesQueried: 0,
      totalChunks: 0,
      retrievalStrategy: 'none' as 'none' | 'specific' | 'overview' | 'explanation',
    };

    // Extract user query from message
    const userQuery = message.parts
      .filter(part => part.type === "text")
      .map(part => part.text)
      .join(" ");

    if (chat) {
      if (chat.userId !== userId) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      // Get selected file IDs from database
      fileIdsToQuery = await getSelectedFileIds({ chatId: id });
      // Only fetch messages if chat already exists
      messagesFromDb = await getMessagesByChatId({ id });
    } else {
      const title = await generateTitleFromUserMessage({
        message,
      });

      if (selectedFileIds && selectedFileIds.length > 0) {
        // New chat - use provided selectedFileIds
        fileIdsToQuery = selectedFileIds;
      }

      await saveChat({
        id,
        userId: userId,
        title,
        visibility: selectedVisibilityType,
        projectId: projectId || null,
      });
      // New chat - no need to fetch messages, it's empty
    }

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    console.log("fileIdsToQuery", fileIdsToQuery)

    // Query documents if we have files selected
    if (fileIdsToQuery.length > 0 && userQuery.trim().length > 0) {
      try {
        // Determine collection ID (projectId if in project, otherwise chatId)
        const collectionId = chat?.projectId || projectId || id;

        // Detect query type for logging
        const queryType = detectQueryType(userQuery);
        ragMetrics.retrievalStrategy = queryType;

        // Enhanced query with smart retrieval strategies
        const queryResult = await queryDocuments({
          projectId: collectionId,
          query: userQuery,
          fileIds: fileIdsToQuery,
          nResults: queryType === 'overview' ? 25 : 10, // More chunks for overview queries
          rerankResults: true, // Enable reranking for better relevance
          diversityThreshold: 0.7, // Avoid too-similar chunks
          enableSmartRetrieval: true, // Enable multi-strategy retrieval for overview queries
        });

        const { documents, metadatas, distances, totalChunks, filesQueried } = queryResult;

        // Update metrics
        ragMetrics = {
          documentsRetrieved: documents.length,
          filesQueried: filesQueried.length,
          totalChunks,
          retrievalStrategy: queryType,
        };

        // Build structured RAG context with query awareness
        if (documents.length > 0) {
          ragContext = buildRAGContext({
            documents,
            metadatas,
            distances,
            filesQueried,
            query: userQuery, // Pass query for context-aware prompt generation
          });

          console.log("RAG Context Statistics:", {
            query: userQuery.slice(0, 100),
            queryType,
            ...ragMetrics,
            contextLength: ragContext.length,
          });
        } else {
          console.log("No relevant documents found for query:", userQuery.slice(0, 100));
        }
      } catch (error) {
        console.error("Error retrieving RAG context:", error);
        // Continue without RAG context if there's an error
      }
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        // Use enhanced system prompt with RAG integration and query awareness
        const enhancedSystemPrompt = systemPromptWithRAG({
          selectedChatModel,
          requestHints,
          ragContext,
          query: userQuery, // Pass query for context-aware instructions
        });

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: enhancedSystemPrompt,
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === "chat-model-reasoning"
              ? []
              : [
                  "getWeather",
                  "createDocument",
                  "updateDocument",
                  "requestSuggestions",
                ],
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: {
            getWeather,
            createDocument: createDocument({ userId, dataStream }),
            updateDocument: updateDocument({ userId, dataStream }),
            requestSuggestions: requestSuggestions({
              userId,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: process.env.NODE_ENV === "production",
            functionId: "stream-text",
            metadata: {
              ragEnabled: ragContext.length > 0,
              // ragMetrics,
            },
          },
          onFinish: async ({ usage }) => {
            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;
              if (!modelId) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              if (!providers) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              const summary = getUsage({ modelId, usage, providers });
              finalMergedUsage = { 
                ...usage, 
                ...summary, 
                modelId,
                // Include RAG metrics in usage data
                ragMetrics: ragContext.length > 0 ? ragMetrics : undefined,
              } as AppUsage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            } catch (err) {
              console.warn("TokenLens enrichment failed", err);
              finalMergedUsage = usage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((currentMessage) => ({
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    // const streamContext = getStreamContext();

    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () =>
    //       stream.pipeThrough(new JsonToSseTransformStream())
    //     )
    //   );
    // }

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Check for Vercel AI Gateway credit card error
    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const {userId} = await auth();

  if (!userId) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== userId) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}

// ============================================================================
// HELPER FUNCTION: Query Type Detection (from version 1)
// ============================================================================

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