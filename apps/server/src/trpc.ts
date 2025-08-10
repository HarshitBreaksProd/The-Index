import { initTRPC, TRPCError } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";
import { User } from "./utils/types";

export const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  const token = req.cookies.jwt;

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET!) as User;
    return { user, res };
  } catch (error) {
    return { user: null, res };
  }
};

export const t = initTRPC.context<typeof createContext>().create();

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const publicProcedure = t.procedure;
export const privateProcedure = t.procedure.use(isAuthenticated);
