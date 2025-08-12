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
  "pdf",
  "youtube",
  "spotify",
  "tweet",
]);
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
  title: varchar("title", { length: 255 }).notNull(),
  status: cardStatusEnum("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  storageUrl: text("storage_url"),
  embedding: vector("embedding", { dimensions: 384 }),
  isShareable: boolean("is_shareable").default(false).notNull(),
  shareableId: uuid("shareable_id").defaultRandom().notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
});

// Join table to facilitate the search of tags and index cards
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

// Defining relations for drizzle to understand better and a self documented piece of code

export const userRelations = relations(users, ({ one, many }) => ({
  indexes: many(indexes),
  indexCards: many(indexCards),
}));

export const indexesRelations = relations(indexes, ({ one, many }) => ({
  user: one(users, {
    fields: [indexes.userId],
    references: [users.id],
  }),
  indexCards: many(indexCards),
}));

export const indexCardsRelations = relations(indexCards, ({ one }) => ({
  index: one(indexes, {
    fields: [indexCards.indexId],
    references: [indexes.id],
  }),
  users: one(users, {
    fields: [indexCards.userId],
    references: [users.id],
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
