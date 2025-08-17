import { db } from "@workspace/db";
import { chatMessages } from "@workspace/db/schema";
import EmbeddingPipeline from "@workspace/embedding-model";
import { desc, eq, sql } from "drizzle-orm";

export const fetchCardContext = async (query: string, indexId: string) => {
  console.log("[RAG] Vectoizing user query...");
  const embedder = await EmbeddingPipeline.getInstance();
  const queryEmbedding = await embedder(query, {
    pooling: "mean",
    normalize: true,
  });

  console.log("[RAG] Performing similarity search");
  const queryVector = JSON.stringify(queryEmbedding.tolist()[0]);

  try {
    const searchResults = await db.execute(sql`
    SELECT 
      cc."chunk_text", cc."card_id"
    FROM
      card_chunks cc
    JOIN
      index_cards ic ON cc."card_id" = ic.id
    WHERE
      ic."index_id" = ${indexId}
    ORDER BY
      cc."embedding" <=> ${queryVector}
    LIMIT 10
  `);

    const context = searchResults.rows
      .map((row: any) => {
        return row.chunk_text;
      })
      .join("\n\n---\n\n");

    const cardsReferencedNonUnique: string[] = searchResults.rows.map((row) => {
      return row.card_id as string;
    });

    const cardsReferenced = [...new Set(cardsReferencedNonUnique)];

    return { context, cardsReferenced };
  } catch (error) {
    console.log("[CONTEXT] Failed to fetch content");
    console.log(error);
    throw new Error(JSON.stringify(error));
  }
};

export const fetchChatContext = async (chatId: string) => {
  try {
    const prevChats = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId))
      .orderBy(desc(chatMessages.id))
      .limit(6);

    const chatContext = prevChats
      .reverse()
      .map((chat, index) => {
        return `${chat.role}: ${chat.content}`;
      })
      .join(`\n\n-----\n\n`);

    return chatContext;
  } catch (error) {
    console.log("[CHATS] Failed to fetch chat context");
    console.log(error);
    throw new Error(JSON.stringify(error));
  }
};
