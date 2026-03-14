import type { IncomingMessage, ServerResponse } from "node:http";

import { buildApp } from "./app.js";

const app = buildApp();
let readyPromise: PromiseLike<void> | null = null;

async function ensureReady() {
  if (!readyPromise) {
    readyPromise = app.ready().then(() => undefined);
  }

  await readyPromise;
}

export async function handleVercelRequest(
  request: IncomingMessage,
  response: ServerResponse
) {
  try {
    await ensureReady();
  } catch (error) {
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({
        error: "bootstrap_failed",
        message: error instanceof Error ? error.message : "API bootstrap failed."
      }));
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    response.once("finish", resolve);
    response.once("close", resolve);
    response.once("error", reject);

    try {
      app.server.emit("request", request, response);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Vercel request handling failed."));
    }
  });
}
