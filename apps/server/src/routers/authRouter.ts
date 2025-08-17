import z from "zod";
import jwt from "jsonwebtoken";
import { publicProcedure, privateProcedure, t } from "../trpc";
import { db } from "@workspace/db";
import bcrypt from "bcrypt";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { users } from "@workspace/db/schema";

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
      if (req.ctx.res) {
        req.ctx.res.cookie("jwt", token, { httpOnly: true });
      }
      return {
        message: "The user has been created",
      };
    }),
  signin: publicProcedure
    .input(z.object({ email: z.string(), password: z.string() }))
    .mutation(async (req) => {
      try {
        const userFound = await db
          .select()
          .from(users)
          .where(eq(users.email, req.input.email))
          .limit(1);

        if (!userFound[0]) {
          return {
            message: "user not found",
          };
        }

        const passwordMatch = bcrypt.compare(
          req.input.password,
          userFound[0]?.passwordHash!
        );

        if (!passwordMatch) {
          return {
            message: "incorrect password",
          };
        }

        const token = jwt.sign(
          { userId: userFound[0].id, name: userFound[0].name },
          process.env.JWT_SECRET!
        );
        if (req.ctx.res) {
          req.ctx.res.cookie("jwt", token, { httpOnly: true });
        }
        return {
          message: "user logged in",
        };
      } catch (error) {
        return {
          message: "error finding user",
        };
      }
    }),
  getUser: privateProcedure.query(async (req) => {
    const userId = Number(req.ctx.user.userId);
    try {
      const user = await db.select().from(users).where(eq(users.id, userId));
      if (!user[0]) {
        return {
          message: "user not found",
        };
      }
      return {
        user: user[0],
      };
    } catch (error) {
      console.log(error);
      return {
        message: "error fetching user info",
      };
    }
  }),
});
