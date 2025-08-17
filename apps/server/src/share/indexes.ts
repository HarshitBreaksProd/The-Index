import { db } from "@workspace/db";
import {
  cardChunks,
  cardsToTags,
  indexCards,
  indexes,
} from "@workspace/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function viewSharedIndex(indexShareableId: string) {
  const [index] = await db
    .select()
    .from(indexes)
    .where(eq(indexes.shareableId, indexShareableId));

  if (!index) {
    throw new Error("No such index exists");
  }

  if (!index.isPublic) {
    throw new Error("Index is not shareable");
  }

  const fetchedIndexCards = await db
    .select()
    .from(indexCards)
    .where(eq(indexCards.indexId, index.id))
    .orderBy(desc(indexCards.createdAt));

  return { index, fetchedIndexCards };
}

export async function copySharedIndex(
  indexShareableId: string,
  userId: number
) {
  const [index] = await db
    .select()
    .from(indexes)
    .where(eq(indexes.shareableId, indexShareableId));

  if (!index) {
    throw new Error("No such index exists");
  }

  if (!index.isPublic) {
    throw new Error("Index is not shareable");
  }

  const originalIndexCards = await db
    .select()
    .from(indexCards)
    .where(eq(indexCards.indexId, index.id));

  if (originalIndexCards.length === 0) {
    const [newIndex] = await db
      .insert(indexes)
      .values({ name: index.name, userId, description: index.description })
      .returning();
    return newIndex?.id;
  }

  const originalCardIds = originalIndexCards.map((c) => c.id);
  const originalChunks = await db
    .select()
    .from(cardChunks)
    .where(inArray(cardChunks.cardId, originalCardIds));
  const originalCardsToTags = await db
    .select()
    .from(cardsToTags)
    .where(inArray(cardsToTags.cardId, originalCardIds));

  const newIndexId = await db.transaction(async (tx) => {
    const [newIndex] = await tx
      .insert(indexes)
      .values({ name: index.name, userId, description: index.description })
      .returning();

    if (!newIndex) {
      throw new Error("Failed to create new Index");
    }

    const idMap = new Map<string, string>();
    const newCardsData = originalIndexCards.map((card) => {
      const newCardId = randomUUID();
      idMap.set(card.id, newCardId);

      return {
        id: newCardId,
        indexId: newIndex.id,
        userId,
        type: card.type,
        source: card.source,
        processedContent: card.processedContent,
        storageUrl: card.storageUrl,
        errorMessage: card.errorMessage,
        title: card.title,
        status: "completed" as const,
        isPublic: false,
      };
    });

    if (newCardsData.length > 0) {
      await tx.insert(indexCards).values(newCardsData);
    }

    const newChunksData = originalChunks.map((chunk) => ({
      cardId: idMap.get(chunk.cardId)!,
      chunkText: chunk.chunkText,
      embedding: chunk.embedding,
    }));

    if (newChunksData.length > 0) {
      await tx.insert(cardChunks).values(newChunksData);
    }

    const newCardsToTagsData = originalCardsToTags.map((tagLink) => ({
      cardId: idMap.get(tagLink.cardId)!,
      tagId: tagLink.tagId,
    }));

    if (newCardsToTagsData.length > 0) {
      await tx.insert(cardsToTags).values(newCardsToTagsData);
    }

    console.log("Successfully copied the index");
    return newIndex.id;
  });

  return newIndexId;
}
