/**
 * Provider-agnostic LLM interface. Product code (extraction, agent) depends only on
 * this file. Each provider adapter translates to and from its native API.
 *
 * Adding a provider = implementing `LLMProvider.complete` (see providers/anthropic.ts).
 */

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool input. Must be an object schema with additionalProperties: false. */
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  name: string;
  content: string;
  isError?: boolean;
}

/** Content blocks a provider accepts in user turns besides text */
export type Attachment =
  | { type: 'text-document'; title: string; text: string }
  | { type: 'pdf'; title: string; base64: string }
  | { type: 'image'; title: string; base64: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' };

export type LLMMessage =
  | { role: 'user'; text: string; attachments?: Attachment[] }
  | {
      role: 'assistant';
      text: string;
      toolCalls: ToolCall[];
      /**
       * Provider-native content of this turn, echoed back verbatim by the same
       * provider (e.g. Claude thinking blocks must be returned unchanged inside a tool loop).
       */
      raw?: unknown;
    }
  | { role: 'tool'; results: ToolResult[] };

export interface CompletionRequest {
  system: string;
  messages: LLMMessage[];
  tools?: ToolSpec[];
  /** Constrain the final answer to this JSON Schema (structured output). */
  outputSchema?: Record<string, unknown>;
  maxTokens?: number;
  /** Relative reasoning effort; adapters map this to their own knobs. */
  effort?: 'low' | 'medium' | 'high';
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
}

export interface CompletionResponse {
  text: string;
  toolCalls: ToolCall[];
  stopReason: 'end' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';
  usage: Usage;
  model: string;
  raw?: unknown;
}

export interface LLMProvider {
  /** e.g. "anthropic", "scripted" */
  readonly id: string;
  readonly model: string;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rate_limit' | 'bad_request' | 'overloaded' | 'refusal' | 'network' | 'unknown',
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
