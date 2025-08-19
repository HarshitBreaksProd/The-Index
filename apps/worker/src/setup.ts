// This file handles cookie problem for yt dlp

import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import "dotenv/config";

function setupCookies() {
  const cookiePath = path.join(
    os.homedir(),
    ".config",
    "chromium",
    "Default",
    "Cookies"
  );

  const cookies = process.env.YT_COOKIES;

  if (cookies) {
    console.log("Found YT_COOKIES env var. Writing to cookie file...");
    try {
      fs.mkdirSync(path.dirname(cookiePath), { recursive: true });
      fs.writeFileSync(cookiePath, cookies);
      console.log("Cookie file created successfully.");
    } catch (error) {
      console.error("Failed to write cookie file:", error);
      process.exit(1);
    }
  } else {
    console.warn(
      "Warning: YT_COOKIES environment variable not set. yt-dlp may fail on protected videos."
    );
  }
}

function startWorker() {
  console.log("Starting the main worker process...");
  const workerProcess = spawn("node", ["dist/index.js"], {
    stdio: "inherit",
  });

  workerProcess.on("close", (code) => {
    console.log(`Worker process exited with code ${code}`);
    process.exit(code ?? 1);
  });

  workerProcess.on("error", (err) => {
    console.error("Failed to start worker process:", err);
    process.exit(1);
  });
}

setupCookies();
startWorker();
