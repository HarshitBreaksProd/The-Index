import { t } from "../trpc";
import { authRouter } from "./authRouter";
import { indexCardRouter } from "./indexCardsRouter";
import { indexesRouter } from "./indexesRouter";

export const appRouter = t.router({
  auth: authRouter,
  indexes: indexesRouter,
  indexCard: indexCardRouter,
});
