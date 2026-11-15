// Smoke test for live mode WITHOUT an API key: points the official SDK at a local mock of the
// Messages API and checks request shape, the tool loop, grounding checks and error mapping.
// Run: npm run smoke:live
/* eslint-disable @typescript-eslint/no-explicit-any */
import http from 'node:http';
import assert from 'node:assert/strict';
const reqs: any[] = [];
const server = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const j = JSON.parse(body); reqs.push({ url: req.url, headers: req.headers, body: j });
    const base = { id: 'msg_1', type: 'message', role: 'assistant', model: j.model, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0 } };
    let content: any[]; let stop = 'end_turn';
    if (j.output_config?.format) {
      content = [{ type: 'text', text: JSON.stringify({ documentType: 'bank-statement', summary: 's', facts: [
        { field: 'otherSources.savingsInterest', amount: 9870, text: null, label: 'Savings interest', quote: 'Total savings interest credited: Rs. 9,870', page: 1, confidence: 0.95 },
        { field: 'otherSources.depositInterest', amount: 1234, text: null, label: 'Made up', quote: 'FD interest Rs. 1,234', page: 1, confidence: 0.9 } ], ambiguities: [] }) }];
    } else {
      const last = j.messages[j.messages.length - 1];
      const hasToolResult = Array.isArray(last.content) && last.content.some((b: any) => b.type === 'tool_result');
      if (!hasToolResult) { content = [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'tool_use', id: 'tu_1', name: 'compute_tax', input: { regime: 'both', overrides: [] } }]; stop = 'tool_use'; }
      else { const r = JSON.parse(last.content[0].content); content = [{ type: 'text', text: `Old regime: ₹${r.old.totalTax.toLocaleString('en-IN')}. Also ₹99,999.` }]; }
    }
    if (j.messages?.[0]?.content?.[0]?.text === 'FAIL') { res.writeHead(429, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } })); }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ...base, content, stop_reason: stop }));
  });
});
server.listen(0, async () => {
  const port = (server.address() as any).port;
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`; process.env.ANTHROPIC_API_KEY = 'test-key';
  const h = await import('../server/handlers');
  const { buildSampleCase } = await import('../src/ai/pipeline');
  const { applyExtraction } = await import('../src/ai/pipeline');
  console.log('health', await (await h.handleHealth()).json());
  const text = 'KOTAK\nTotal savings interest credited: Rs. 9,870';
  const ex = await h.handleExtract(new Request('http://x/api/extract', { method: 'POST', body: JSON.stringify({ document: { name: 'k.txt', mimeType: 'text/plain', text } }) }));
  const run = await ex.json(); console.log('extract', ex.status, run.extractor);
  const applied = applyExtraction({ id: 'd', name: 'k.txt', text }, run);
  console.log('grounding', applied.facts.map((f: any) => [f.field, f.grounded, f.confidence]));
  const ch = await h.handleChat(new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify({ message: 'regime?', history: [], caseFile: buildSampleCase() }) }));
  const cr = await ch.json(); console.log('chat', ch.status, cr.answer, cr.steps.map((s: any) => s.tool), 'ungrounded:', cr.grounding.amounts.filter((a: any) => !a.grounded).map((a: any) => a.text));
  const second = reqs[reqs.length - 1].body;
  console.log('2nd request echoes thinking block:', second.messages[1].content[0].type, '| tools strict:', second.tools.every((t: any) => t.strict), '| betas header:', reqs[1].headers['anthropic-beta'], '| fallbacks:', second.fallbacks, '| effort:', second.output_config.effort, '| model:', second.model);
  const fail = await h.handleChat(new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify({ message: 'FAIL', history: [], caseFile: buildSampleCase() }) }));
  console.log('rate limit →', fail.status, await fail.json());
  const bad = await h.handleChat(new Request('http://x/api/chat', { method: 'POST', body: '{"nope":1}' }));
  console.log('bad body →', bad.status);
  assert.equal(ex.status, 200);
  assert.deepEqual(applied.facts.map((f: any) => f.grounded), [true, false], 'fabricated citation must fail grounding');
  assert.equal(ch.status, 200);
  assert.deepEqual(cr.grounding.amounts.filter((a: any) => !a.grounded).map((a: any) => a.text), ['₹99,999']);
  assert.equal(second.messages[1].content[0].type, 'thinking', 'thinking blocks must be echoed unchanged');
  assert.ok(second.tools.every((t: any) => t.strict));
  assert.equal(fail.status, 429);
  assert.equal(bad.status, 400);
  console.log('\nAll live-mode wiring checks passed.');
  server.close();
});
