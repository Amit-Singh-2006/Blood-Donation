import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ASSISTANT_TOOLS, isAssistantRole, systemPrompt } from '../utils/aiPrompts';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
// The gpt-oss models reason before answering, and that reasoning shares this
// budget, so keep it short and leave room for the reply itself.
const MAX_COMPLETION_TOKENS = 2048;
const REASONING = { reasoning_effort: 'low', include_reasoning: false };

/**
 * POST /ai/chat (signed-in accounts only)
 *
 * Proxies chat completions to Groq so the API key stays on the server
 * (it previously shipped in the public frontend bundle as VITE_GROQ_API_KEY).
 * req.body has already been whitelisted by chatCompletionSchema. The
 * instructions come from the server for the account's role, and only that
 * role's tools are passed on, so the key cannot power an arbitrary chatbot.
 */
export const chatCompletion = async (req: AuthRequest, res: Response) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ message: 'The AI assistant is not configured.' });
    }
    const role = req.user?.role;
    if (!isAssistantRole(role)) return res.status(403).json({ message: 'The assistant is not available for this account.' });

    const allowedTools = new Set(ASSISTANT_TOOLS[role]);
    const tools = (req.body.tools ?? []).filter((t: any) => allowedTools.has(t.function?.name));
    const body = {
        model: req.body.model,
        messages: [
            { role: 'system', content: systemPrompt(role) },
            ...req.body.messages.filter((m: any) => m.role !== 'system'),
        ],
        ...(tools.length ? { tools, tool_choice: req.body.tool_choice ?? 'auto' } : {}),
        ...(req.body.temperature !== undefined ? { temperature: req.body.temperature } : {}),
    };

    try {
        const groqRes = await fetch(GROQ_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ ...body, ...REASONING, max_completion_tokens: MAX_COMPLETION_TOKENS }),
            signal: AbortSignal.timeout(60000),
        });
        const data: any = await groqRes.json().catch(() => ({}));

        if (!groqRes.ok) {
            console.error('Groq API error:', groqRes.status, data?.error?.message);
            return res.status(502).json({ message: 'The AI assistant is unavailable right now.' });
        }
        res.json(data);
    } catch (err: any) {
        console.error('Groq request failed:', err?.message ?? err);
        res.status(502).json({ message: 'The AI assistant is unavailable right now.' });
    }
};
