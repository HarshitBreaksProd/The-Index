import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { createContext } from "./trpc";
import { appRouter } from "./routers";
import "dotenv/config";
import cookieparser from "cookie-parser";
import http from "http";
import { WebSocketServer } from "ws";
import { applyWSSHandler } from "@trpc/server/adapters/ws";

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

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

const handler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext,
});

process.on("SIGTERM", () => {
  console.log("SIGTERM recieved. Shutting down gracefully");
  handler.broadcastReconnectNotification();
  wss.close();
  server.close();
});

server.listen(process.env.SERVER_PORT, () => {
  console.log(`The server is running on ${process.env.SERVER_PORT}`);
});

export type AppRouter = typeof appRouter;
