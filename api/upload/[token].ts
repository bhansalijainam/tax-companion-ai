// Vercel function — public client upload page API; the token is the credential (server/workspace.ts)
import { handle } from '../../api/_workspace.js';

export const GET = handle;
export const POST = handle;
