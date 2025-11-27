import {
  boolean,
  foreignKey,
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


export const sourceTypeEnum = pgEnum("source_types", ["file", "website", "youtube"])
export const documentKindEnum = pgEnum("document_kind", ["text", "code", "image", "sheet", "quiz", "flashcard", "report", "slides"])


export const project = pgTable("project", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  title: text("title").notNull(),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sources table
export const source = pgTable("source", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  sourceType: sourceTypeEnum().notNull(),
  mediaType: text("media_type").notNull(),
  filename: text("filename").notNull(),
  fileKey: text("file_key"),
  url: text("url").notNull(),
  chromaCollectionName: text("chroma_collection_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chat = pgTable("chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("created_at").notNull(),
  title: text("title").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").references(() => project.id, { onDelete: "cascade" }),
  sources: jsonb("sources").$type<string[]>().default([]),
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
    chatId: uuid("chat_id").references(() => chat.id),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content"),
    kind: documentKindEnum()
    .notNull()
    .default("text"),
    createdAt: timestamp("created_at").notNull(),
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


export type Project = typeof project.$inferSelect;
export type Source = typeof source.$inferSelect;
export type Chat = typeof chat.$inferSelect;
export type DBMessage = typeof message.$inferSelect;
export type Vote = typeof vote.$inferSelect;
export type Document = typeof document.$inferSelect;
export type Suggestion = typeof suggestion.$inferSelect;
export type Stream = typeof stream.$inferSelect;
