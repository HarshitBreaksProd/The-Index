import { initTRPC, TRPCError } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import jwt from "jsonwebtoken";
import { User } from "./utils/types";
import { users } from "@workspace/db/schema";
import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Response } from "express";

export const createContext = async (
  opts: trpcExpress.CreateExpressContextOptions | CreateWSSContextFnOptions
) => {
  const { req, res } = opts;
  let token: string | undefined;

  if ("cookies" in req && req.cookies.jwt) {
    // handling cookie from express
    token = req.cookies.jwt;
  } else if (req.headers.cookie) {
    // handling cookie from jwt
    token = req.headers.cookie
      .split(";")
      .find((c) => c.trim().startsWith("jwt="))
      ?.split("=")[1];
  }

  if (!token) {
    return { user: null, res: res as Response | undefined };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as User;

    const [userFromDb] = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(decoded.userId)));

    if (!userFromDb) {
      return { user: null };
    }

    return { user: decoded, res: res as Response | undefined };
  } catch (e) {
    return { user: null, res: res as Response | undefined };
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
