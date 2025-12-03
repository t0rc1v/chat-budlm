// new schema
import {
  boolean,
  foreignKey,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";


export const documentKindEnum = pgEnum("document_kind", ["text", "code", "image", "sheet", "quiz", "flashcard", "report", "slides"])
export const fileStatusEnum = pgEnum("file_status", ["processing", "ready", "failed"]);


export const project = pgTable("project", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const chatFile = pgTable("chat_file", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  chatId: uuid("chat_id").references(() => chat.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => project.id, { 
    onDelete: "cascade" 
  }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  uploadthingKey: text("uploadthing_key").notNull(),
  chromaCollectionId: text("chroma_collection_id"),
  embeddingStatus: varchar("embedding_status", {
    enum: ["pending", "processing", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  metadata: jsonb("metadata").$type<{
    pageCount?: number;
    isScanned?: boolean;
    [key: string]: any;
  }>(),
  createdAt: timestamp("created_at").notNull(),
});

// File selection - tracks which files are selected per chat
export const fileSelection = pgTable("file_selection", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  fileId: uuid("file_id")
    .notNull()
    .references(() => chatFile.id, { onDelete: "cascade" }),
  isSelected: boolean("is_selected").notNull().default(true),
  createdAt: timestamp("created_at").notNull(),
});

export const chat = pgTable("chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("created_at").notNull(),
  title: text("title").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").references(() => project.id, { onDelete: "set null" }),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  lastContext: jsonb("last_context").$type<AppUsage | null>(),
});

export const message = pgTable("message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const vote = pgTable(
  "vote",
  {
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("message_id")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("is_upvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export const document = pgTable(
  "document",
  {
    id: uuid("id").notNull().defaultRandom(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    // chatId: uuid("chat_id").notNull().references(() => chat.id),
    createdAt: timestamp("created_at").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: documentKindEnum()
      .notNull()
      .default("text"),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export const suggestion = pgTable(
  "suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("document_id").notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    documentCreatedAt: timestamp("document_created_at").notNull(),
    originalText: text("original_text").notNull(),
    suggestedText: text("suggested_text").notNull(),
    description: text("description"),
    isResolved: boolean("is_resolved").notNull().default(false),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export const stream = pgTable(
  "stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chat_id").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export const fileShare = pgTable("file_share", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  fileId: uuid("file_id")
    .notNull()
    .references(() => chatFile.id, { onDelete: "cascade" }),
  sharedWithEmail: varchar("shared_with_email", { length: 255 }),
  permission: varchar("permission", { enum: ["view", "edit"] })
    .notNull()
    .default("view"),
  sharedBy: varchar("shared_by", { length: 255 }).notNull(),
  shareToken: text("share_token"),
  createdAt: timestamp("created_at").notNull(),
});


export type Chat = typeof chat.$inferSelect;
export type DBMessage = typeof message.$inferSelect;
export type Vote = typeof vote.$inferSelect;
export type Document = typeof document.$inferSelect;
export type Suggestion = typeof suggestion.$inferSelect;
export type Stream = typeof stream.$inferSelect;
export type Project = typeof project.$inferSelect;
export type ChatFile = typeof chatFile.$inferSelect;
export type FileSelection = typeof fileSelection.$inferSelect;

