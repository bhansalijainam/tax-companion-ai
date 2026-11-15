import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Sparkles, Wrench, ShieldCheck, ShieldAlert, ChevronDown, Trash2, AlertCircle } from 'lucide-react';
import { useCase, type ChatMessage } from '@/state/CaseContext';
import { PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const SUGGESTED = [
  'Which regime should the client choose, and why?',
  'What if the client invests ₹50,000 in NPS under 80CCD(1B)?',
  'What open issues should I raise with the client before filing?',
  'Where does the rent paid figure come from?',
  'How much deduction headroom is left?',
];

function Trace({ m }: { m: ChatMessage }) {
  const r = m.result;
  if (!r) return null;
  const ungrounded = r.grounding.amounts.filter((a) => !a.grounded);
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {r.grounding.ok ? (
          <span className="inline-flex items-center gap-1 text-success" title="Every ₹ figure in this answer appears in a tool result or is a statutory limit">
            <ShieldCheck className="w-3.5 h-3.5" /> {r.grounding.amounts.length} figure{r.grounding.amounts.length === 1 ? '' : 's'} traced to tools
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-destructive" title="These figures did not come from any tool result">
            <ShieldAlert className="w-3.5 h-3.5" /> untraced: {ungrounded.map((a) => a.text).join(', ')}
          </span>
        )}
        <span>· {r.provider === 'scripted' ? 'scripted demo provider' : r.model}</span>
        {r.usage.inputTokens > 0 && <span>· {r.usage.inputTokens.toLocaleString()} in / {r.usage.outputTokens.toLocaleString()} out tokens</span>}
      </div>
      {r.steps.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Wrench className="w-3.5 h-3.5" /> {r.steps.length} tool call{r.steps.length > 1 ? 's' : ''}: {r.steps.map((s) => s.tool).join(', ')}
            <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {r.steps.map((s, i) => (
              <div key={i} className="rounded-md border border-border bg-background p-2 text-[11px] font-mono">
                <p className={cn('font-semibold', s.isError && 'text-destructive')}>{s.tool}({JSON.stringify(s.input)}) · {s.ms}ms</p>
                <pre className="mt-1 whitespace-pre-wrap break-all text-muted-foreground max-h-40 overflow-auto">{prettify(s.output)}</pre>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function prettify(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 1).slice(0, 3000);
  } catch {
    return s.slice(0, 3000);
  }
}

export function ChatView() {
  const { chat, chatBusy, sendChat, clearChat, mode, status } = useCase();
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, chatBusy]);

  const send = (text: string) => {
    if (!text.trim() || chatBusy) return;
    setInput('');
    void sendChat(text.trim());
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] animate-fade-in">
      <PageHeader
        title="Assistant"
        subtitle={mode === 'live'
          ? `${status?.model} with six read-only tools over this case. It cannot do arithmetic itself: tax figures come from compute_tax, and every ₹ amount in an answer is checked against tool output.`
          : 'Demo mode: a scripted provider picks tools by keyword and fills templates. The tools, trace and figure check are real; switch to live mode for Claude.'}
        actions={chat.length > 0 ? <Button variant="ghost" size="sm" onClick={clearChat}><Trash2 className="w-4 h-4" /> Clear</Button> : undefined}
      />

      <div className="flex-1 mt-4 bg-card rounded-xl border border-border overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chat.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center"><Bot className="w-6 h-6 text-accent" /></div>
              <p className="text-sm text-muted-foreground max-w-md">Ask about this client's income, deductions, regime choice, what-if scenarios, or where a number came from.</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                {SUGGESTED.map((q) => (
                  <button key={q} onClick={() => send(q)} className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 transition-colors">
                    <Sparkles className="w-3 h-3 inline mr-1" />{q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chat.map((m) => (
            <div key={m.id} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', m.role === 'user' ? 'bg-primary' : 'bg-accent')}>
                {m.role === 'user' ? <User className="w-4 h-4 text-primary-foreground" /> : <Bot className="w-4 h-4 text-accent-foreground" />}
              </div>
              <div className={cn('max-w-[85%] md:max-w-[75%]', m.role === 'user' && 'text-right')}>
                <div className={cn('inline-block text-left px-4 py-3 rounded-2xl text-sm', m.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md')}>
                  {m.error ? (
                    <p className="flex items-center gap-2 text-destructive"><AlertCircle className="w-4 h-4" /> {m.error}</p>
                  ) : m.role === 'assistant' ? (
                    <div className="prose-chat"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
                {m.role === 'assistant' && <Trace m={m} />}
              </div>
            </div>
          ))}

          {chatBusy && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center"><Bot className="w-4 h-4 text-accent-foreground" /></div>
              <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-md flex gap-1 items-center">
                {[0, 150, 300].map((d) => <span key={d} className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="p-3 border-t border-border flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about income, deductions, regime, what-ifs…" className="flex-1" maxLength={4000} />
          <Button type="submit" disabled={!input.trim() || chatBusy} aria-label="Send"><Send className="w-4 h-4" /></Button>
        </form>
      </div>
    </div>
  );
}
