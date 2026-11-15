import type { CaseFile } from '../../domain/types';
import type { LLMMessage, LLMProvider, ToolResult, Usage } from '../llm/types';
import { checkAnswerGrounding, GroundingReport } from './grounding';
import { AGENT_SYSTEM_PROMPT } from './systemPrompt';
import { executeTool, TOOL_SPECS } from './tools';

export interface AgentStep {
  tool: string;
  input: Record<string, unknown>;
  output: string;
  isError: boolean;
  ms: number;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  grounding: GroundingReport;
  usage: Usage;
  model: string;
  provider: string;
  stoppedBecause: 'answered' | 'max_steps' | 'refusal' | 'max_tokens';
}

const MAX_TOOL_OUTPUT_CHARS = 12_000;

/**
 * Provider-agnostic tool loop. The model plans and writes; tools hold all data and do
 * all arithmetic. The loop is bounded, every step is recorded for the UI trace, and
 * the final answer is checked for numbers that did not come from a tool.
 */
export async function runAgent(
  provider: LLMProvider,
  caseFile: CaseFile,
  history: ChatTurn[],
  userMessage: string,
  opts: { maxSteps?: number } = {},
): Promise<AgentResult> {
  const maxSteps = opts.maxSteps ?? 6;
  // Replay the last few turns as plain text (tool traces stay in their own turn).
  // The conversation must start with a user message.
  const recent = history.slice(-10);
  while (recent.length && recent[0].role !== 'user') recent.shift();
  const messages: LLMMessage[] = [
    ...recent.map((t): LLMMessage => (t.role === 'user' ? { role: 'user', text: t.content } : { role: 'assistant', text: t.content, toolCalls: [] })),
    { role: 'user', text: userMessage },
  ];
  const steps: AgentStep[] = [];
  const usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  let model = provider.model;

  for (let i = 0; i < maxSteps; i++) {
    const res = await provider.complete({ system: AGENT_SYSTEM_PROMPT, messages, tools: TOOL_SPECS, effort: 'medium' });
    usage.inputTokens += res.usage.inputTokens;
    usage.outputTokens += res.usage.outputTokens;
    usage.cacheReadTokens = (usage.cacheReadTokens ?? 0) + (res.usage.cacheReadTokens ?? 0);
    model = res.model;

    if (res.stopReason === 'refusal' || res.stopReason === 'max_tokens') {
      return finish(res.text || 'I could not complete that request.', steps, usage, model, provider.id, userMessage, res.stopReason);
    }
    if (res.toolCalls.length === 0) {
      return finish(res.text, steps, usage, model, provider.id, userMessage, 'answered');
    }

    messages.push({ role: 'assistant', text: res.text, toolCalls: res.toolCalls, raw: res.raw });
    const results: ToolResult[] = res.toolCalls.map((call) => {
      const started = performance.now();
      let content: string;
      let isError = false;
      try {
        content = JSON.stringify(executeTool(call.name, call.input, caseFile));
      } catch (e) {
        content = `Error: ${e instanceof Error ? e.message : String(e)}`;
        isError = true;
      }
      if (content.length > MAX_TOOL_OUTPUT_CHARS) content = content.slice(0, MAX_TOOL_OUTPUT_CHARS) + '…[truncated]';
      steps.push({ tool: call.name, input: call.input, output: content, isError, ms: Math.round(performance.now() - started) });
      return { id: call.id, name: call.name, content, isError };
    });
    messages.push({ role: 'tool', results });
  }

  return finish('I reached the step limit before finishing. Try a narrower question.', steps, usage, model, provider.id, userMessage, 'max_steps');
}

function finish(
  answer: string, steps: AgentStep[], usage: Usage, model: string, provider: string, userMessage: string,
  stoppedBecause: AgentResult['stoppedBecause'],
): AgentResult {
  const grounding = checkAnswerGrounding(answer, [userMessage, ...steps.map((s) => s.output)]);
  return { answer, steps, grounding, usage, model, provider, stoppedBecause };
}
