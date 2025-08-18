import z from "zod";
import { privateProcedure, publicProcedure, t } from "../trpc";
import { db } from "@workspace/db";
import { and, desc, eq, lt } from "drizzle-orm";
import { indexCards, indexes } from "@workspace/db/schema";

export const indexesRouter = t.router({
  create: privateProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async (req) => {
      const userId = Number(req.ctx.user.userId);
      const description = req.input.description ?? "update description";
      try {
        const createdIndex = await db
          .insert(indexes)
          .values({
            name: req.input.name,
            description,
            userId,
          })
          .returning();

        return {
          createdIndex: createdIndex[0],
        };
      } catch (error) {
        console.log(error);
        return {
          message: "faced error while creating the index",
        };
      }
    }),
  changeShareability: privateProcedure
    .input(z.object({ value: z.boolean(), indexId: z.string() }))
    .mutation(async (req) => {
      try {
        const toBeUpdatedIndex = await db
          .select({ userId: indexes.userId })
          .from(indexes)
          .where(eq(indexes.id, req.input.indexId));

        const indexUserId = toBeUpdatedIndex[0]?.userId;

        if (Number(req.ctx.user.userId) !== indexUserId) {
          return {
            message: "Only the owner of index can change it",
          };
        }

        const updatedIndex = await db
          .update(indexes)
          .set({ isPublic: req.input.value })
          .where(eq(indexes.id, req.input.indexId))
          .returning();

        return {
          updatedIndex: updatedIndex[0],
        };
      } catch (error) {
        console.log(error);
        return {
          message: "faced an error while chaging shareability",
        };
      }
    }),
  fetchIndexesPaginated: privateProcedure
    .input(z.object({ cursor: z.string().optional(), pageSize: z.string() }))
    .query(async (req) => {
      try {
        const cursorDate = req.input.cursor
          ? new Date(req.input.cursor)
          : undefined;

        const pageSize = Number(req.input.pageSize);

        const fetchedIndexes = await db
          .select()
          .from(indexes)
          .orderBy(desc(indexes.createdAt))
          .limit(pageSize)
          .where(
            and(
              cursorDate ? lt(indexes.createdAt, cursorDate) : undefined,
              eq(indexes.userId, Number(req.ctx.user.userId))
            )
          );

        const hasNextPage = fetchedIndexes.length === pageSize;
        const nextCursor =
          fetchedIndexes[fetchedIndexes.length - 1]?.createdAt.toISOString();

        return {
          fetchedIndexes,
          hasNextPage,
          nextCursor,
        };
      } catch (error) {
        console.log(error);
        return {
          message: "faced error while fetching indexes",
        };
      }
    }),
  prefetchOnHover: privateProcedure
    .input(z.object({ indexId: z.string() }))
    .query(async (req) => {
      try {
        const fetchedIndexCards = await db
          .select()
          .from(indexCards)
          .limit(10)
          .orderBy(desc(indexCards.createdAt))
          .where(eq(indexCards.indexId, req.input.indexId));

        return {
          fetchedIndexCards,
        };
      } catch (error) {
        console.log(error);
        return {
          message: "unable to pre fetch cards",
        };
      }
    }),
  fetchIndexCardsPaginated: privateProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        pageSize: z.string(),
        indexId: z.string(),
      })
    )
    .query(async (req) => {
      try {
        const cursorDate = req.input.cursor
          ? new Date(req.input.cursor)
          : undefined;

        const pageSize = Number(req.input.pageSize);

        const fetchedIndexCards = await db
          .select()
          .from(indexCards)
          .limit(pageSize)
          .orderBy(desc(indexCards.createdAt))
          .where(
            and(
              cursorDate ? lt(indexCards.createdAt, cursorDate) : undefined,
              eq(indexCards.indexId, req.input.indexId)
            )
          );

        const hasNextPage = fetchedIndexCards.length === pageSize;
        const nextCursor =
          fetchedIndexCards[
            fetchedIndexCards.length - 1
          ]?.createdAt.toISOString();

        return {
          fetchedIndexCards,
          hasNextPage,
          nextCursor,
        };
      } catch (error) {
        console.log(error);
        return {
          message: "error fetching cards",
        };
      }
    }),
  fetchSharedIndexCardsPaginated: publicProcedure
    .input(
      z.object({
        shareableId: z.string(),
        pageSize: z.string(),
        cursor: z.string().optional(),
      })
    )
    .query(async (req) => {
      try {
        const fetchedIndex = await db
          .select({ isPublic: indexes.isPublic, id: indexes.id })
          .from(indexes)
          .where(eq(indexes.shareableId, req.input.shareableId));

        if (fetchedIndex[0]?.isPublic) {
          const pageSize = Number(req.input.pageSize);
          const indexId = fetchedIndex[0].id;
          const cursorDate = req.input.cursor
            ? new Date(req.input.cursor)
            : undefined;

          const fetchedIndexCards = await db
            .select()
            .from(indexCards)
            .limit(pageSize)
            .orderBy(desc(indexCards.createdAt))
            .where(
              and(
                cursorDate ? lt(indexCards.createdAt, cursorDate) : undefined,
                eq(indexCards.indexId, indexId)
              )
            );

          const hasNextPage = fetchedIndexCards.length === pageSize;
          const nextCursor =
            fetchedIndexCards[
              fetchedIndexCards.length - 1
            ]?.createdAt.toISOString();

          return {
            fetchedIndexCards,
            hasNextPage,
            nextCursor,
          };
        } else {
          return {
            message: "This index is not public",
          };
        }
      } catch (error) {
        console.log(error);
        return {
          message: "error fetching shared index",
        };
      }
    }),
});
