/**
 * Claude adapter for the provider-agnostic LLM interface.
 * SERVER-SIDE ONLY: it reads the API key from the environment. Never import it from browser code.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { BetaContentBlock, BetaContentBlockParam, BetaMessageParam, BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { CompletionRequest, CompletionResponse, LLMError, LLMMessage, LLMProvider } from '../types';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  private client: Anthropic;

  constructor(
    readonly model: string = DEFAULT_ANTHROPIC_MODEL,
    apiKey?: string,
  ) {
    this.client = new Anthropic(apiKey ? { apiKey } : {});
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const tools: BetaToolUnion[] | undefined = req.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      strict: true,
    }));

    try {
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 16_000,
        // Stable system prompt first so it is cached across calls
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        messages: toAnthropicMessages(req.messages),
        ...(tools?.length ? { tools } : {}),
        thinking: { type: 'adaptive' },
        output_config: {
          effort: req.effort ?? 'medium',
          ...(req.outputSchema ? { format: { type: 'json_schema' as const, schema: req.outputSchema } } : {}),
        },
        // If a safety classifier declines, retry server-side on a fallback model
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });

      const text = response.content
        .filter((b): b is Extract<BetaContentBlock, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const toolCalls = response.content
        .filter((b): b is Extract<BetaContentBlock, { type: 'tool_use' }> => b.type === 'tool_use')
        .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));

      return {
        text,
        toolCalls,
        stopReason:
          response.stop_reason === 'end_turn' ? 'end'
          : response.stop_reason === 'tool_use' ? 'tool_use'
          : response.stop_reason === 'max_tokens' ? 'max_tokens'
          : response.stop_reason === 'refusal' ? 'refusal'
          : 'other',
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
        },
        model: response.model,
        raw: response.content,
      };
    } catch (err) {
      throw toLLMError(err);
    }
  }
}

function toAnthropicMessages(messages: LLMMessage[]): BetaMessageParam[] {
  return messages.map((m): BetaMessageParam => {
    if (m.role === 'user') {
      const content: BetaContentBlockParam[] = [];
      for (const a of m.attachments ?? []) {
        if (a.type === 'text-document') {
          content.push({ type: 'document', title: a.title, source: { type: 'text', media_type: 'text/plain', data: a.text } });
        } else if (a.type === 'pdf') {
          content.push({ type: 'document', title: a.title, source: { type: 'base64', media_type: 'application/pdf', data: a.base64 } });
        } else {
          content.push({ type: 'image', source: { type: 'base64', media_type: a.mediaType, data: a.base64 } });
        }
      }
      content.push({ type: 'text', text: m.text });
      return { role: 'user', content };
    }
    if (m.role === 'assistant') {
      // Echo native content (incl. thinking blocks) unchanged when we have it
      if (Array.isArray(m.raw)) return { role: 'assistant', content: m.raw as BetaContentBlockParam[] };
      const content: BetaContentBlockParam[] = [];
      if (m.text) content.push({ type: 'text', text: m.text });
      for (const c of m.toolCalls) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.input });
      return { role: 'assistant', content };
    }
    // All tool results for one assistant turn go back in a single user message
    return {
      role: 'user',
      content: m.results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content, is_error: r.isError ?? false })),
    };
  });
}

function toLLMError(err: unknown): LLMError {
  // Client-facing messages are generic; provider detail goes to `detail` for server logs.
  const detail = err instanceof Error ? err.message : String(err);
  if (err instanceof Anthropic.AuthenticationError) return new LLMError('Model provider is not configured correctly', 'auth', false, detail);
  if (err instanceof Anthropic.RateLimitError) return new LLMError('Rate limited by the model provider', 'rate_limit', true, detail);
  if (err instanceof Anthropic.BadRequestError) return new LLMError('The model provider rejected the request', 'bad_request', false, detail);
  if (err instanceof Anthropic.InternalServerError) return new LLMError('Model provider error', 'overloaded', true, detail);
  if (err instanceof Anthropic.APIConnectionError) return new LLMError('Could not reach the model provider', 'network', true, detail);
  if (err instanceof Anthropic.APIError) return new LLMError('Model provider error', 'unknown', false, `${err.status}: ${detail}`);
  return new LLMError('Model call failed', 'unknown', false, detail);
}
