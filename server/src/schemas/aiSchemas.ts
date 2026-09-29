import { z } from 'zod';

const toolCallSchema = z.object({
    id: z.string().max(100),
    type: z.literal('function'),
    function: z.object({
        name: z.string().max(100),
        arguments: z.string().max(10000),
    }),
});

const messageSchema = z.discriminatedUnion('role', [
    z.object({ role: z.literal('system'), content: z.string().max(20000) }),
    z.object({ role: z.literal('user'), content: z.string().max(4000) }),
    z.object({
        role: z.literal('assistant'),
        content: z.string().max(10000).nullable().optional(),
        tool_calls: z.array(toolCallSchema).max(10).optional(),
    }),
    z.object({
        role: z.literal('tool'),
        tool_call_id: z.string().max(100),
        name: z.string().max(100).optional(),
        content: z.string().max(20000),
    }),
]);

const toolSchema = z.object({
    type: z.literal('function'),
    function: z.object({
        name: z.string().max(100),
        description: z.string().max(2000).optional(),
        parameters: z.record(z.string(), z.unknown()).optional(),
    }),
});

/**
 * Only the models the app uses are allowed, so the server-side key cannot be
 * used to run arbitrary (more expensive) models. Groq retired the Llama 3.1 8B
 * and 3.3 70B models these replaced on 2026-08-16.
 */
export const CHAT_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'] as const;

export const chatCompletionSchema = z.object({
    model: z.enum(CHAT_MODELS),
    messages: z.array(messageSchema).min(1).max(60),
    tools: z.array(toolSchema).max(20).optional(),
    tool_choice: z.enum(['auto', 'none']).optional(),
    temperature: z.number().min(0).max(2).optional(),
});
