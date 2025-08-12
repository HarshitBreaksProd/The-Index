import z from "zod";
import { privateProcedure, publicProcedure, t } from "../trpc";
import { db, indexCards, indexes } from "@workspace/db";
import { and, desc, eq, lt } from "drizzle-orm";

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
        const createdIndexCard = await db
          .insert(indexCards)
          .values({
            indexId: req.input.indexId,
            userId: Number(req.ctx.user.userId),
            type: req.input.type,
            source: req.input.source,
            title: req.input.title,
          })
          .returning();
        return {
          createdIndexCard: createdIndexCard[0],
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
          .set({ isShareable: req.input.value })
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

        if (fetchedIndexCard[0]?.isShareable) {
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
});
