import { handleVercelRequest } from "../../dist/vercel-handler.js";

export default async function handler(request, response) {
  await handleVercelRequest(request, response);
}
