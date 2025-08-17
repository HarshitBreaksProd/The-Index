import { Worker } from "bullmq";
import { processingQueue, redisConnection } from "@workspace/queue";
import type { CardProcessingJobData } from "@workspace/queue";
import { db } from "@workspace/db";
import { cardChunks, indexCards } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import "dotenv/config";
import axios from "axios";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import EmbeddingPipeline from "@workspace/embedding-model";

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
        chunkSize: 750,
        chunkOverlap: 75,
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

      console.log(
        `[DB] Inserting ${chunks.length} chunks into the database...`
      );

      const embeddingsList = embeddings.tolist();

      const chunkDataToInsert = chunks
        .map((chunkText, index) => {
          const embedding = embeddingsList[index];
          return {
            cardId: card.id,
            chunkText,
            embedding,
          };
        })
        .filter((chunk) => chunk.chunkText && chunk.embedding);

      try {
        await retry(async () => {
          console.log(
            `[DB] Attempting to insert ${chunkDataToInsert.length} chunks...`
          );
          await db.insert(cardChunks).values(chunkDataToInsert);
        });
        console.log("[DB] Batch insert successful.");
      } catch (error) {
        console.error("[DB] Batch insert failed after all retries", error);

        throw new Error("Failed to insert chunks into the database");
      }

      await db
        .update(indexCards)
        .set({
          status: "completed",
          processedContent,
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

async function retry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.log(`[RETRY] Operation failed. Retrying in ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
      return retry(fn, retries - 1, delay);
    }
    throw error;
  }
}
