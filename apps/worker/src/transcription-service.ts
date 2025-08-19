import YTDlpWrap from "yt-dlp-wrap";
import { retry } from "./utils/retry";
import os from "os";
import path from "path";
import fs from "fs";
import { AssemblyAI } from "assemblyai";
import "dotenv/config";

const assemblyClient = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

const ytDlpWrap = new YTDlpWrap();

export const runTranscriptionService = async (url: string) => {
  console.log("[TRANSCRIPTION] Downloading audio...");
  const audioFilePath = path.join("./temp", `${Date.now()}.mp3`);
  const cookiesPath = path.join("./temp", `cookies-${Date.now()}.txt`);
  
  await ytDlpWrap.execPromise([
    url,
    "-x",
    "--audio-format",
    "mp3",
    "--no-keep-video",
    "-f",
    "bestaudio",
    "--cookies", 
    cookiesPath,
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
    fs.unlinkSync(audioFilePath);
    throw new Error(JSON.stringify(error));
  }
  fs.unlinkSync(audioFilePath);

  return youtubeTranscript;
};
