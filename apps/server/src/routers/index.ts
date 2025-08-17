import { t } from "../trpc";
import { authRouter } from "./authRouter";
import { chatRouter } from "./chatRouter";
import { indexCardRouter } from "./indexCardsRouter";
import { indexesRouter } from "./indexesRouter";
import { shareRouter } from "./shareRouter";

export const appRouter = t.router({
  auth: authRouter,
  indexes: indexesRouter,
  indexCard: indexCardRouter,
  chat: chatRouter,
  share: shareRouter,
});
