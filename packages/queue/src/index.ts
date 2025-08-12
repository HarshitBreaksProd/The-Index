import { Queue } from "bullmq";
import "dotenv/config";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL!;
if (!redisUrl) {
  throw new Error("REDIS_URL must be defined in the env");
}

export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

export const processingQueue = new Queue("card-processing", {
  connection: redisConnection,
});

export interface CardProcessingJobData {
  cardId: string;
}
