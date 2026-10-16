/**
 * Lets work finish after the response has been sent. Vercel freezes a function
 * once it has answered unless the work is handed to the runtime's waitUntil;
 * this is what @vercel/functions' waitUntil does, without its dependencies.
 * Locally the server keeps running, so the work simply carries on.
 */
const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');

export const background = (task: Promise<unknown>) => {
    const safe = task.catch((err) => console.error('Background task failed:', err?.message ?? err));
    const context = (globalThis as any)[REQUEST_CONTEXT]?.get?.();
    context?.waitUntil?.(safe);
};
