import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const sampleQuestions = [
  "What's the total 80C deduction available?",
  "Show me all flagged expenses",
  "What is the recommended tax regime?",
  "Summarize the income sources",
];

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI Tax Assistant. I've analyzed the uploaded documents for this client. You can ask me questions about their income, expenses, investments, tax calculations, or any flagged items. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses: Record<string, string> = {
        '80c': "Based on the extracted documents, the total 80C deduction claimed is ₹1,50,000:\n\n• LIC Premium: ₹50,000 (from LIC_Premium_Receipt.pdf)\n• PPF Contribution: ₹1,00,000 (from PPF_Passbook.pdf)\n\nThe section 80C limit of ₹1,50,000 is fully utilized. No additional investment is required under this section.",
        'flagged': "There are 4 flagged items requiring attention:\n\n1. **HRA Claim - ₹2,40,000** (High Priority)\n   - Missing rent receipts for verification\n\n2. **ABC Coaching Classes - ₹45,000** (Medium Priority)\n   - Unclear if educational or personal expense\n\n3. **Vehicle Purchase - ₹8,50,000** (Medium Priority)\n   - Needs depreciation schedule calculation\n\n4. **Missing GST Invoices - ₹12,000** (Low Priority)\n   - ITC may be reversed without invoices",
        'regime': "Based on the analysis, the **New Tax Regime** is recommended.\n\n**Old Regime:** ₹1,95,000\n**New Regime:** ₹1,74,000\n\n**Savings: ₹21,000** with New Regime\n\nThe deductions under Chapter VI-A (₹2,75,000) are not sufficient to make the old regime more beneficial given the client's income level.",
        'income': "Here's a summary of income sources:\n\n| Source | Type | Amount |\n|--------|------|--------|\n| ABC Technologies | Salary | ₹12,00,000 |\n| Flat Rent - Andheri | Rental | ₹3,60,000 |\n| HDFC Savings | Interest | ₹15,000 |\n\n**Total Gross Income: ₹15,75,000**\n\nRental income will have 30% standard deduction applied (net: ₹2,52,000).",
      };

      let response = "I'd be happy to help with that. Based on the documents analyzed:\n\nThe client has a gross income of ₹15,75,000 with total deductions of ₹2,75,000. The recommended tax regime is 'New' with potential savings of ₹21,000.\n\nIs there anything specific you'd like me to elaborate on?";

      const lowerInput = input.toLowerCase();
      if (lowerInput.includes('80c')) response = responses['80c'];
      else if (lowerInput.includes('flag')) response = responses['flagged'];
      else if (lowerInput.includes('regime') || lowerInput.includes('recommend')) response = responses['regime'];
      else if (lowerInput.includes('income') || lowerInput.includes('summar')) response = responses['income'];

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleQuickQuestion = (question: string) => {
    setInput(question);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Assistant</h1>
          <p className="text-muted-foreground mt-1">
            Ask questions about the client's documents and analysis
          </p>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 animate-fade-in",
                message.role === 'user' && "flex-row-reverse"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                message.role === 'user' ? "bg-primary" : "bg-accent"
              )}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4 text-primary-foreground" />
                ) : (
                  <Bot className="w-4 h-4 text-accent-foreground" />
                )}
              </div>
              <div className={cn(
                "max-w-[75%] p-4 rounded-2xl",
                message.role === 'user' 
                  ? "bg-primary text-primary-foreground rounded-br-md" 
                  : "bg-muted rounded-bl-md"
              )}>
                <p className="text-sm whitespace-pre-line">{message.content}</p>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <Bot className="w-4 h-4 text-accent-foreground" />
              </div>
              <div className="bg-muted p-4 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Suggested questions
            </p>
            <div className="flex flex-wrap gap-2">
              {sampleQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuickQuestion(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about income, expenses, deductions, tax calculation..."
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim() || isTyping}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
