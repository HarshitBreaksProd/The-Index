import z from "zod";
import { privateProcedure, publicProcedure, t } from "../trpc";
import { copySharedIndex, viewSharedIndex } from "../share/indexes";
import { db } from "@workspace/db";
import { indexCards } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { copySharedIndexCard, viewSharedIndexCard } from "../share/indexCards";

export const shareRouter = t.router({
  viewIndex: publicProcedure
    .input(z.object({ indexShareableId: z.string() }))
    .query(async (req) => {
      try {
        const { indexShareableId } = req.input;
        const data = await viewSharedIndex(indexShareableId);
        return data;
      } catch (error) {
        console.log("failed to fetch shared index.");
        console.log(error);
        return {
          message: "failed to fetch shared index.",
        };
      }
    }),

  viewIndexCard: publicProcedure
    .input(z.object({ indexCardShareableId: z.string() }))
    .query(async (req) => {
      try {
        const { indexCardShareableId } = req.input;
        const data = await viewSharedIndexCard(indexCardShareableId);
        return data;
      } catch (error) {
        console.log("failed to fetch shared card.");
        console.log(error);
        return {
          message: "failed to fetch shared card.",
        };
      }
    }),

  copyIndex: privateProcedure
    .input(z.object({ indexShareableId: z.string() }))
    .mutation(async (req) => {
      try {
        const { indexShareableId } = req.input;
        const newIndexId = await copySharedIndex(
          indexShareableId,
          Number(req.ctx.user.userId)
        );

        return { newIndexId };
      } catch (error) {
        console.log("failed copying shared index");
        console.log(error);
        return {
          message: "failed copying shared index",
        };
      }
    }),

  copyIndexCard: privateProcedure
    .input(z.object({ indexCardShareableId: z.string(), indexId: z.string() }))
    .mutation(async (req) => {
      try {
        const { indexCardShareableId, indexId } = req.input;
        const newIndexCardId = await copySharedIndexCard(
          indexCardShareableId,
          indexId,
          Number(req.ctx.user.userId)
        );
        return {
          newIndexCardId,
        };
      } catch (error) {
        console.log("failed to copy index card");
        console.log(error);
        return {
          message: "failed to copy index card",
        };
      }
    }),
});
