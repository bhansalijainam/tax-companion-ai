// Vercel serverless function — see server/handlers.ts
import { handleExtract } from '../server/handlers.js';

export const config = { maxDuration: 60 };

export function POST(req: Request) {
  return handleExtract(req);
}
