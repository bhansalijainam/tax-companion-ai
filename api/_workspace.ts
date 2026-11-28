// Shared entry for workspace routes (Vercel functions). See server/workspace.ts.
import { routeWorkspace } from '../server/workspace.js';

export async function handle(req: Request): Promise<Response> {
  return (await routeWorkspace(req)) ?? new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}
