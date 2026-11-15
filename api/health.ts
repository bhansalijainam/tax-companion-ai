// Vercel serverless function — see server/handlers.ts
import { handleHealth } from '../server/handlers';

export const config = { maxDuration: 60 };

export function GET() {
  return handleHealth();
}
