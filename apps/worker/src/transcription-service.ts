import YTDlpWrap from "yt-dlp-wrap";
import { retry } from "./utils/retry";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { AssemblyAI } from "assemblyai";
import "dotenv/config";

const assemblyClient = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

const ytDlpWrap = new YTDlpWrap();

export const runTranscriptionService = async (url: string) => {
  await fs.mkdir("temp", { recursive: true });
  const audioFilePath = path.join("./temp", `${Date.now()}.mp3`);
  const cookiesFilePath = path.join("./temp", `${Date.now()}`);

  await fs.writeFile(cookiesFilePath, process.env.YT_COOKIES!);

  console.log("[TRANSCRIPTION] Downloading audio...");
  await ytDlpWrap.execPromise([
    url,
    "-x",
    "--audio-format",
    "mp3",
    "--no-keep-video",
    "--cookies",
    cookiesFilePath,
    "-o",
    audioFilePath,
  ]);

  console.log("[TRANSCRIPTION] Audio downloaded...", audioFilePath);
  const params = {
    audio: audioFilePath,
  };

  let youtubeTranscript;

  try {
    console.log("[TRANSCRIPTION] Trancripton Starting...");
    youtubeTranscript = await retry(async () => {
      const transcript = await assemblyClient.transcripts.transcribe(params);
      return transcript;
    });
    console.log("[TRANSCRIPTION] Trancripton produced...");
  } catch (error) {
    console.log("error transcripting");
    console.log(error);
    await fs.unlink(audioFilePath);
    await fs.unlink(cookiesFilePath);
    throw new Error(JSON.stringify(error));
  }

  await fs.unlink(audioFilePath);
  await fs.unlink(cookiesFilePath);

  return youtubeTranscript;
};
