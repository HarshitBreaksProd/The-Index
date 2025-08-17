import { fetchChatContext } from "./contextFetch";
import { retry } from "../utils/retry";
import { model } from "./model";

export const streamRagResponse = async ({
  query,
  context,
  chatId,
}: {
  query: string;
  context: string;
  chatId: string;
}) => {
  try {
    let chatContext = "";

    if (chatId) {
      chatContext = await retry(() => fetchChatContext(chatId));
    } else {
      chatContext = "This is the first message of this chat";
    }

    console.log("[RAG] Assembling prompt for LLM...");

    const prompt = `You are an expert assistant; your goal is to synthesize a beautiful and comprehensive answer for the user.
Your primary source of truth is the provided context; you must ground your answer in it.
Format your entire response using clear and well-structured Markdown for readability.
Supplement your answer with external knowledge over the internet to provide richer detail and a complete response.
Sources Context:
====
${context}
====
Chats Context:
====
${chatContext}
====
Question: ${query}`;

    console.log("[RAG] Calling LLM...");

    const result = await model.generateContentStream(prompt);

    return result.stream;
  } catch (error) {
    console.log("faced error answering query");
    console.log(error);
    throw new Error(JSON.stringify(error || {}));
  }
};
