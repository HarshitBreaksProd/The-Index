import { t } from "../trpc";
import { authRouter } from "./authRouter";

export const appRouter = t.router({
  auth: authRouter,
});
