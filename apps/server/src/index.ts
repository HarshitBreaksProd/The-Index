import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { createContext } from "./trpc";
import { appRouter } from "./routers";
import "dotenv/config";
import cookieparser from "cookie-parser";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(cookieparser());
app.use(
  "/api/v1",
  trpcExpress.createExpressMiddleware({ router: appRouter, createContext })
);

// healthcheck
app.get("/health", (req, res) => {
  res.send("Healthy");
});

app.listen(process.env.PORT, () => {
  console.log(`The server is running on ${process.env.PORT}`);
});

export type AppRouter = typeof appRouter;
