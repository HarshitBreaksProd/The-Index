import z from "zod";
import { privateProcedure, publicProcedure, t } from "../trpc";
import { db } from "@workspace/db";
import { and, desc, eq, lt } from "drizzle-orm";
import { CardProcessingJobData, processingQueue } from "@workspace/queue";
import { indexCards, indexes } from "@workspace/db/schema";

export enum CardType {
  text = "text",
  url = "url",
  pdf = "pdf",
  youtube = "youtube",
  spotify = "spotify",
  tweet = "tweet",
}

export enum CardStatus {
  pending = "pending",
  processing = "processing",
  completed = "completed",
  failed = "failed",
}

export const indexCardRouter = t.router({
  create: privateProcedure
    .input(
      z.object({
        indexId: z.string(),
        type: z.nativeEnum(CardType),
        source: z.string(),
        title: z.string(),
      })
    )
    .mutation(async (req) => {
      try {
        const toBeUpdatedIndex = await db
          .select({ userId: indexes.userId })
          .from(indexes)
          .where(eq(indexes.id, req.input.indexId));

        const indexUserId = toBeUpdatedIndex[0]?.userId;

        if (Number(req.ctx.user.userId) !== indexUserId) {
          return {
            message: "Only the owner of index can add cards to it",
          };
        }

        const [createdIndexCard] = await db
          .insert(indexCards)
          .values({
            indexId: req.input.indexId,
            userId: Number(req.ctx.user.userId),
            type: req.input.type,
            source: req.input.source,
            title: req.input.title,
          })
          .returning();

        // Logic to use queue
        await processingQueue.add(`process-card-${createdIndexCard?.id}`, {
          cardId: createdIndexCard?.id,
        } as CardProcessingJobData);

        console.log(`Dispatched job for ${createdIndexCard?.id}`);

        return {
          createdIndexCard: createdIndexCard,
        };
      } catch (error) {
        console.log(error);
        return {
          message: "could not create index card",
        };
      }
    }),
  changeShareability: privateProcedure
    .input(
      z.object({
        value: z.boolean(),
        indexCardId: z.string(),
      })
    )
    .mutation(async (req) => {
      try {
        const toBeUpdatedCard = await db
          .select({ userId: indexCards.userId })
          .from(indexCards)
          .where(eq(indexCards.id, req.input.indexCardId));

        const cardUserId = toBeUpdatedCard[0]?.userId;

        if (Number(req.ctx.user.userId) !== cardUserId) {
          return {
            message: "Only the owner of card can change it",
          };
        }

        const updatedIndexCard = await db
          .update(indexCards)
          .set({ isPublic: req.input.value })
          .where(eq(indexCards.id, req.input.indexCardId))
          .returning();
        return {
          updatedIndexCard: updatedIndexCard[0],
        };
      } catch (error) {
        console.log(error);
        return {
          message: "error faced while changing shareability",
        };
      }
    }),

  fetchSharableIndexCard: publicProcedure
    .input(z.object({ shareableId: z.string() }))
    .query(async (req) => {
      try {
        const fetchedIndexCard = await db
          .select()
          .from(indexCards)
          .where(eq(indexCards.shareableId, req.input.shareableId));

        if (fetchedIndexCard[0]?.isPublic) {
          return {
            fetchedIndexCard: fetchedIndexCard[0],
          };
        } else {
          return {
            message: "this card isn't public",
          };
        }
      } catch (error) {
        console.log(error);
        return {
          message: "could not fetch index card",
        };
      }
    }),

  retryCardProcessing: privateProcedure
    .input(z.object({ cardId: z.string() }))
    .mutation(async (req) => {
      try {
        const [indexCard] = await db
          .select()
          .from(indexCards)
          .where(eq(indexCards.id, req.input.cardId));

        if (indexCard?.userId !== Number(req.ctx.user.userId)) {
          throw new Error("Only the cards owner can trigger reprocessing");
        }
        await processingQueue.add(`process-card-${req.input.cardId}`, {
          cardId: req.input.cardId,
        } as CardProcessingJobData);
        console.log(`Dispatched job for ${req.input.cardId}`);

        return {
          message: "Started processing the card",
        };
      } catch (error) {
        console.log("Error re processing card");
        console.log(error);
        return {
          message: "could not retry processing of card",
        };
      }
    }),
});
