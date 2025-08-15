import { Worker } from "bullmq";
import { processingQueue, redisConnection } from "@workspace/queue";
import type { CardProcessingJobData } from "@workspace/queue";
import { db } from "@workspace/db";
import { indexCards } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import "dotenv/config";
import axios from "axios";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import EmbeddingPipeline from "./embedding";

const CRAWLER_URL = process.env.CRAWLER_URL;
if (!CRAWLER_URL) {
  throw new Error("CRAWLER_URL is not defined in the environment");
}

const worker = new Worker<CardProcessingJobData>(
  processingQueue.name,
  async (job) => {
    const { cardId } = job.data;
    console.log(`[JOB START] Processing cardId: ${cardId}`);

    try {
      await db
        .update(indexCards)
        .set({ status: "processing" })
        .where(eq(indexCards.id, cardId));

      const [card] = await db
        .select()
        .from(indexCards)
        .where(eq(indexCards.id, cardId));

      if (!card) {
        throw new Error(`Card with ID ${cardId} not found.`);
      }

      let processedContent: string | null = null;

      switch (card.type) {
        case "text":
          console.log(`[PROCESSING] Type: text.`);
          processedContent = card.source;
          break;
        case "url":
          console.log(
            `[PROCESSING] Type: url. Calling crawler for: ${card.source}`
          );
          const response = await axios.get(`${CRAWLER_URL}/scrape`, {
            params: { url: card.source },
          });
          processedContent = response.data.content;
          console.log(
            `[SUCCESS] Crawler returned content of length: ${processedContent?.length}`
          );
          break;

        default:
          throw new Error(`Unsupported card type: ${card.type}`);
      }

      if (!processedContent) {
        throw new Error("No content could be processed from the source");
      }

      console.log("[CHUNKING] Splitting content into chunks...");
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100,
      });
      const chunks = await splitter.splitText(processedContent);
      console.log(`[CHUNKING] Created ${chunks.length} chunks.`);

      console.log("[VECTORIZING] Generating embeddings for chunks...");
      const embedder = await EmbeddingPipeline.getInstance();

      const embeddings = await embedder(chunks, {
        pooling: "mean",
        normalize: true,
      });
      console.log("[VECTORIZING] Embeddings generated successfully.");

      const avgEmbedding = averageEmbeddings(embeddings.tolist());

      await db
        .update(indexCards)
        .set({
          status: "completed",
          embedding: avgEmbedding,
        })
        .where(eq(indexCards.id, cardId));

      console.log(`[JOB SUCCESS] Finished processing cardId: ${cardId}`);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "An unknown error occurred";
      console.error(
        `[JOB FAILED] Error processing cardId ${cardId}:`,
        errorMessage
      );

      await db
        .update(indexCards)
        .set({
          status: "failed",
          errorMessage: errorMessage,
        })
        .where(eq(indexCards.id, cardId));

      throw error;
    }
  },
  { connection: redisConnection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} has been completed`);
});

worker.on("failed", (job, err) => {
  console.log(`Job ${job?.id} has failed with an error: ${err.message}`);
});

const averageEmbeddings: (embeddings: number[][]) => number[] = (
  embeddings
) => {
  if (embeddings.length === 0) return [];

  const embeddingLength = embeddings[0]!.length;
  const avg = new Array(embeddingLength).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < embeddingLength; i++) {
      avg[i] += embedding[i];
    }
  }

  for (let i = 0; i < embeddingLength; i++) {
    avg[i] /= embeddings.length;
  }
  return avg;
};
