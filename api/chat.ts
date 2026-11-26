// Vercel serverless function — see server/handlers.ts
import { handleChat } from '../server/handlers.js';

export const config = { maxDuration: 60 };

export function POST(req: Request) {
  return handleChat(req);
}
