import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRes } from './helpers';
import { chatCompletionSchema } from '../src/schemas/aiSchemas';
import { chatCompletion } from '../src/controllers/aiController';
import { injectionGuard } from '../src/middleware/securityMiddleware';

afterEach(() => {
    mock.restoreAll();
    delete process.env.GROQ_API_KEY;
});

// The shape AgentChat sends mid-conversation: system prompt, a tool call and its result
const agentPayload = {
    model: 'llama-3.3-70b-versatile',
    messages: [
        { role: 'system', content: 'You are LifeLink AI (an assistant). Use **tools**.' },
        { role: 'user', content: 'Raise an O- request for 4 units' },
        {
            role: 'assistant', content: null,
            tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'create_emergency_request', arguments: '{"blood_group":"O-"}' } }],
        },
        { role: 'tool', name: 'create_emergency_request', tool_call_id: 'call_1', content: 'created' },
    ],
    tools: [{ type: 'function', function: { name: 'get_requests', description: 'List requests', parameters: { type: 'object', properties: {} } } }],
    tool_choice: 'auto',
    temperature: 0,
};

test('chat schema accepts the AgentChat and ChatBot payloads', () => {
    assert.ok(chatCompletionSchema.safeParse(agentPayload).success);
    assert.ok(chatCompletionSchema.safeParse({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'Can I donate?' }] }).success);
});

test('chat schema rejects models outside the allowlist and oversized input', () => {
    assert.equal(chatCompletionSchema.safeParse({ ...agentPayload, model: 'llama-3.1-405b' }).success, false);
    assert.equal(chatCompletionSchema.safeParse({ ...agentPayload, messages: [] }).success, false);
    assert.equal(chatCompletionSchema.safeParse({
        model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'x'.repeat(5000) }],
    }).success, false);
});

test('injectionGuard lets chat prompts containing ( ) * through on /ai/chat only', () => {
    let passed = false;
    injectionGuard({ path: '/ai/chat', body: agentPayload, query: {}, params: {} } as any, fakeRes(), () => { passed = true; });
    assert.equal(passed, true);

    passed = false;
    injectionGuard({ path: '/hospital/requests', body: agentPayload, query: {}, params: {} } as any, fakeRes(), () => { passed = true; });
    assert.equal(passed, false);
});

test('chatCompletion returns 503 when the server key is not configured', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => { throw new Error('should not be called'); });
    const res = fakeRes();
    await chatCompletion({ body: agentPayload } as any, res);
    assert.equal(res.statusCode, 503);
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('chatCompletion forwards with the server-side key and a token cap', async () => {
    process.env.GROQ_API_KEY = 'server-secret';
    const fetchMock = mock.method(globalThis, 'fetch', async () =>
        new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Hi' } }] }), { status: 200 }));
    const res = fakeRes();
    await chatCompletion({ body: agentPayload } as any, res);

    const [url, init] = fetchMock.mock.calls[0]!.arguments as [string, RequestInit];
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal((init.headers as Record<string, string>)['Authorization'], 'Bearer server-secret');
    assert.equal(JSON.parse(init.body as string).max_tokens, 1024);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.choices[0].message.content, 'Hi');
});

test('chatCompletion hides upstream error details', async () => {
    process.env.GROQ_API_KEY = 'server-secret';
    mock.method(globalThis, 'fetch', async () =>
        new Response(JSON.stringify({ error: { message: 'Invalid API Key: gsk_live_...' } }), { status: 401 }));
    mock.method(console, 'error', () => { });
    const res = fakeRes();
    await chatCompletion({ body: agentPayload } as any, res);
    assert.equal(res.statusCode, 502);
    assert.doesNotMatch(JSON.stringify(res.body), /gsk_|API Key/);
});
