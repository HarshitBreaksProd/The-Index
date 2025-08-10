import z from "zod";
import jwt from "jsonwebtoken";
import { publicProcedure, t } from "../trpc";
import { db, users } from "@workspace/db";
import bcrypt from "bcrypt";
import { DrizzleQueryError } from "drizzle-orm";

export type NeonDbError = {
  code: String;
  detail: String;
};

export const authRouter = t.router({
  signup: publicProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string(),
        password: z.string().min(8),
      })
    )
    .mutation(async (req) => {
      const unhashedPwd = req.input.password;
      const hashedPwd = await bcrypt.hash(
        unhashedPwd,
        Number(process.env.SALTHROUNDS!)
      );
      let token = "";
      try {
        const dbRes = await db
          .insert(users)
          .values({
            name: req.input.name,
            email: req.input.email,
            passwordHash: hashedPwd,
          })
          .returning();
        if (dbRes[0]) {
          token = jwt.sign(
            { userId: dbRes[0].id, name: dbRes[0].name },
            process.env.JWT_SECRET!
          );
        }
      } catch (error) {
        if (error instanceof DrizzleQueryError) {
          if (error.cause?.name === "NeonDbError") {
            const dbError = error.cause as unknown as NeonDbError;
            console.log(dbError.code);
            console.log(dbError.detail);
            return {
              message: `Cannot create user ${dbError.detail!}`,
            };
          }
        }
        return {
          message: "error creating user",
        };
      }
      if (token === "") {
        return {
          message: "error creating token for user",
        };
      }
      req.ctx.res.cookie("jwt", token, { httpOnly: true });
      return {
        message: "The user has been created",
      };
    }),
  signin: publicProcedure
    .input(z.object({ email: z.string(), password: z.string() }))
    .mutation((req) => {}),
});
