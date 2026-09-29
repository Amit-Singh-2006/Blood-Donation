import { Request, Response } from 'express';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
// The gpt-oss models reason before answering, and that reasoning shares this
// budget, so keep it short and leave room for the reply itself.
const MAX_COMPLETION_TOKENS = 2048;
const REASONING = { reasoning_effort: 'low', include_reasoning: false };

/**
 * POST /ai/chat
 *
 * Proxies chat completions to Groq so the API key stays on the server
 * (it previously shipped in the public frontend bundle as VITE_GROQ_API_KEY).
 * req.body has already been whitelisted by chatCompletionSchema.
 */
export const chatCompletion = async (req: Request, res: Response) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ message: 'The AI assistant is not configured.' });
    }

    try {
        const groqRes = await fetch(GROQ_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ ...req.body, ...REASONING, max_completion_tokens: MAX_COMPLETION_TOKENS }),
        });
        const data: any = await groqRes.json().catch(() => ({}));

        if (!groqRes.ok) {
            console.error('Groq API error:', groqRes.status, data?.error?.message);
            return res.status(502).json({ message: 'The AI assistant is unavailable right now.' });
        }
        res.json(data);
    } catch (err) {
        console.error('Groq request failed:', err);
        res.status(502).json({ message: 'The AI assistant is unavailable right now.' });
    }
};
