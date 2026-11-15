/**
 * HTTP handlers for live AI mode, written against the Web Fetch API (Request → Response)
 * so the same code runs as Vercel functions (api/*.ts) and as Vite dev middleware.
 *
 * The API key never leaves the server. The browser sends the case file it already
 * holds; nothing is persisted server-side.
 */
import { z } from 'zod';
import { runAgent } from '../src/ai/agent/runAgent';
import { LLMExtractor } from '../src/ai/extraction/llmExtractor';
import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from '../src/ai/llm/providers/anthropic';
import { LLMError, LLMProvider } from '../src/ai/llm/types';
import type { CaseFile } from '../src/domain/types';

const MAX_BODY_BYTES = 4_000_000; // Vercel's request limit is ~4.5 MB

/** Provider registry: add new providers here. Selected with LLM_PROVIDER. */
function createProvider(): LLMProvider | null {
  const provider = process.env.LLM_PROVIDER ?? 'anthropic';
  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
    return new AnthropicProvider(process.env.LLM_MODEL || DEFAULT_ANTHROPIC_MODEL);
  }
  return null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function authorize(req: Request): Response | null {
  const token = process.env.ACCESS_TOKEN;
  if (token && req.headers.get('x-access-token') !== token) return json({ error: 'Access token required for live mode' }, 401);
  return null;
}

async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BODY_BYTES) throw new LLMError('Request too large', 'bad_request', false);
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new LLMError('Request too large', 'bad_request', false);
  return JSON.parse(text);
}

function errorResponse(err: unknown): Response {
  if (err instanceof LLMError) {
    const status = err.kind === 'auth' ? 502 : err.kind === 'rate_limit' ? 429 : err.kind === 'bad_request' ? 400 : 503;
    return json({ error: err.message, kind: err.kind, retryable: err.retryable }, status);
  }
  if (err instanceof z.ZodError || err instanceof SyntaxError) return json({ error: 'Invalid request body' }, 400);
  console.error(err);
  return json({ error: 'Internal error' }, 500);
}

export async function handleHealth(): Promise<Response> {
  const p = createProvider();
  return json({ live: Boolean(p), provider: p?.id ?? null, model: p?.model ?? null, accessTokenRequired: Boolean(process.env.ACCESS_TOKEN) });
}

const ExtractBody = z.object({
  document: z.object({
    name: z.string().max(300),
    mimeType: z.string(),
    text: z.string().max(400_000).optional(),
    base64: z.string().optional(),
  }),
});

export async function handleExtract(req: Request): Promise<Response> {
  const denied = authorize(req);
  if (denied) return denied;
  const provider = createProvider();
  if (!provider) return json({ error: 'Live mode is not configured' }, 503);
  try {
    const { document } = ExtractBody.parse(await readJson(req));
    const run = await new LLMExtractor(provider).extract(document);
    return json(run);
  } catch (err) {
    return errorResponse(err);
  }
}

const ChatBody = z.object({
  message: z.string().min(1).max(4_000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(20_000) })).max(40),
  // The case file is client state; the tools only read it.
  caseFile: z.custom<CaseFile>((v) => typeof v === 'object' && v !== null && Array.isArray((v as CaseFile).facts)),
});

export async function handleChat(req: Request): Promise<Response> {
  const denied = authorize(req);
  if (denied) return denied;
  const provider = createProvider();
  if (!provider) return json({ error: 'Live mode is not configured' }, 503);
  try {
    const body = ChatBody.parse(await readJson(req));
    // Binary payloads are not needed for chat; strip them to keep prompts small
    const caseFile: CaseFile = { ...body.caseFile, documents: body.caseFile.documents.map(({ base64: _b, ...d }) => d) };
    const result = await runAgent(provider, caseFile, body.history, body.message);
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
