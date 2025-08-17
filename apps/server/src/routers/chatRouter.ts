import { privateProcedure, t } from "../trpc";
import z from "zod";
import { db } from "@workspace/db";
import { chatMessages, chats } from "@workspace/db/schema";
import { retry } from "../utils/retry";
import { streamRagResponse } from "../rag/aiResponse";
import { fetchCardContext } from "../rag/contextFetch";

type StreamedData = {
  chunk: string;
  chatId: string;
  cardsReferenced: string[];
};

export const chatRouter = t.router({
  askQueryStream: privateProcedure
    .input(
      z.object({
        query: z.string(),
        indexId: z.string(),
        chatId: z.string().optional(),
      })
    )
    .subscription(async function* ({
      ctx,
      input,
    }): AsyncGenerator<StreamedData> {
      const { query, indexId, chatId } = input;
      const userId = Number(ctx.user.userId);

      let currentChatId: string;
      try {
        if (!chatId) {
          const [newChat] = await retry(() =>
            db
              .insert(chats)
              .values({ name: query.slice(0, 30), userId, indexId })
              .returning()
          );
          currentChatId = newChat!.id;
        } else {
          currentChatId = chatId;
        }

        await retry(() =>
          db
            .insert(chatMessages)
            .values({ content: query, role: "user", chatId: currentChatId })
        );

        let fullResponse = "";

        const { context, cardsReferenced } = await fetchCardContext(
          query,
          indexId
        );

        const stream = await streamRagResponse({
          query,
          context,
          chatId: currentChatId,
        });

        for await (const chunk of stream) {
          const chunkText = chunk.text();
          fullResponse += chunkText;
          yield { chunk: chunkText, chatId: currentChatId, cardsReferenced };
        }

        await retry(() =>
          db.insert(chatMessages).values({
            content: fullResponse,
            role: "assistant",
            chatId: currentChatId,
          })
        );
      } catch (error) {
        console.log("Error in RAG stream", JSON.stringify(error));
        throw error;
      }
    }),
});
