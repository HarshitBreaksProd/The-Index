import { Worker } from "bullmq";
import { processingQueue, redisConnection } from "@workspace/queue";
import type { CardProcessingJobData } from "@workspace/queue";

const worker = new Worker<CardProcessingJobData>(
  processingQueue.name,
  async (job) => {
    const { cardId } = job.data;
    console.log(`Processing Job for cardId: ${cardId}`);
  },
  { connection: redisConnection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} has been completed`);
});

worker.on("failed", (job, err) => {
  console.log(`Job ${job?.id} has failed with an error: ${err.message}`);
});
