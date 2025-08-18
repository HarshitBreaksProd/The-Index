import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  uuid,
  integer,
  vector,
  pgEnum,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const cardTypeEnum = pgEnum("card_type", [
  "text",
  "url",
  "pdf", // -> support will be added later
  "youtube",
  "spotify",
  "tweet",
]);

export const messageRole = pgEnum("message_role", ["user", "assistant"]);

export const cardStatusEnum = pgEnum("card_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const indexes = pgTable("indexes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  isPublic: boolean("is_public").default(false).notNull(),
  shareableId: uuid("shareable_id").defaultRandom().notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const indexCards = pgTable("index_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  indexId: uuid("index_id")
    .notNull()
    .references(() => indexes.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: cardTypeEnum("type").notNull(),
  source: text("source").notNull(),
  processedContent: text("processed_content").default(""),
  title: varchar("title", { length: 255 }).notNull(),
  status: cardStatusEnum("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  storageUrl: text("storage_url"),
  isPublic: boolean("is_public").default(false).notNull(),
  shareableId: uuid("shareable_id").defaultRandom().notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
});

export const cardsToTags = pgTable(
  "cards_to_tags",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => indexCards.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.tagId] })]
);

export const cardChunks = pgTable("card_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: uuid("card_id")
    .notNull()
    .references(() => indexCards.id, { onDelete: "cascade" }),
  chunkText: text("chunk_text").notNull(),
  embedding: vector("embedding", { dimensions: 384 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  indexId: uuid("index_id")
    .notNull()
    .references(() => indexes.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: messageRole("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messagesToCardsSources = pgTable(
  "messages_to_cards_sources",
  {
    messageId: integer("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => indexCards.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.messageId, t.cardId] }),
  })
);

// Defining relations for drizzle to understand better and a self documented piece of code

export const userRelations = relations(users, ({ one, many }) => ({
  indexes: many(indexes),
  indexCards: many(indexCards),
  chats: many(chats),
}));

export const indexesRelations = relations(indexes, ({ one, many }) => ({
  user: one(users, {
    fields: [indexes.userId],
    references: [users.id],
  }),
  indexCards: many(indexCards),
  chats: many(chats),
}));

export const indexCardsRelations = relations(indexCards, ({ one, many }) => ({
  index: one(indexes, {
    fields: [indexCards.indexId],
    references: [indexes.id],
  }),
  user: one(users, {
    fields: [indexCards.userId],
    references: [users.id],
  }),
  cardChunks: many(cardChunks),
  cardsToTags: many(cardsToTags),
}));

export const cardChunksRelations = relations(cardChunks, ({ one }) => ({
  card: one(indexCards, {
    fields: [cardChunks.cardId],
    references: [indexCards.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  cardsToTags: many(cardsToTags),
}));

export const cardsToTagsRelations = relations(cardsToTags, ({ one }) => ({
  card: one(indexCards, {
    fields: [cardsToTags.cardId],
    references: [indexCards.id],
  }),
  tag: one(tags, {
    fields: [cardsToTags.tagId],
    references: [tags.id],
  }),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id],
  }),
  index: one(indexes, {
    fields: [chats.indexId],
    references: [indexes.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMessages.chatId],
    references: [chats.id],
  }),
}));

export const messagesToCardsSourcesRelations = relations(
  messagesToCardsSources,
  ({ one }) => ({
    message: one(chatMessages, {
      fields: [messagesToCardsSources.messageId],
      references: [chatMessages.id],
    }),
    card: one(indexCards, {
      fields: [messagesToCardsSources.cardId],
      references: [indexCards.id],
    }),
  })
);
