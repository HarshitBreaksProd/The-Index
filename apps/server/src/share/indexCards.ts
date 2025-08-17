import { db } from "@workspace/db";
import { cardChunks, cardsToTags, indexCards } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export const viewSharedIndexCard = async (indexCardShareableId: string) => {
  const [indexCard] = await db
    .select()
    .from(indexCards)
    .where(eq(indexCards.shareableId, indexCardShareableId));

  if (!indexCard) {
    return {
      message: "No such Index Card exists",
    };
  }

  if (!indexCard.isPublic) {
    return {
      message: "Index Card is not shareable",
    };
  }

  return {
    indexCard,
  };
};

export const copySharedIndexCard = async (
  indexCardShareableId: string,
  indexId: string,
  userId: number
) => {
  const [originalIndexCard] = await db
    .select()
    .from(indexCards)
    .where(eq(indexCards.shareableId, indexCardShareableId));

  if (!originalIndexCard) {
    return {
      message: "No such Index Card exists",
    };
  }

  if (!originalIndexCard.isPublic) {
    return {
      message: "Index Card is not shareable",
    };
  }

  const originalChunks = await db
    .select()
    .from(cardChunks)
    .where(eq(cardChunks.cardId, originalIndexCard.id));
  const originalCardsToTags = await db
    .select()
    .from(cardsToTags)
    .where(eq(cardsToTags.cardId, originalIndexCard.id));

  const newIndexCardId = await db.transaction(async (tx) => {
    const [newIndexCard] = await tx
      .insert(indexCards)
      .values({
        indexId,
        userId,
        type: originalIndexCard.type,
        title: originalIndexCard.title,
        source: originalIndexCard.source,
        processedContent: originalIndexCard.processedContent,
        status: originalIndexCard.status,
        storageUrl: originalIndexCard.storageUrl,
        errorMessage: originalIndexCard.errorMessage,
        isPublic: false,
      })
      .returning();

    const newChunksData = originalChunks.map((chunk) => ({
      cardId: newIndexCard!.id,
      chunkText: chunk.chunkText,
      embedding: chunk.embedding,
    }));

    if (newChunksData.length > 0) {
      await tx.insert(cardChunks).values(newChunksData);
    }

    const newCardsToTagsData = originalCardsToTags.map((tagLink) => ({
      cardId: tagLink.cardId,
      tagId: tagLink.tagId,
    }));

    if (newCardsToTagsData.length > 0) {
      await tx.insert(cardsToTags).values(newCardsToTagsData);
    }

    console.log("Successfully copied the index");
    return newIndexCard!.id;
  });
  return newIndexCardId;
};
