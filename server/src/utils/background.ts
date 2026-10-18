import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/**
 * Lets work finish after the answer is ready, such as sending an email.
 *
 * Vercel freezes a function once it has answered unless the work is handed to
 * the runtime's waitUntil; this is what @vercel/functions' waitUntil does,
 * without its dependencies. Everywhere else (Google Cloud Run, which gives the
 * server CPU only while a request is open, and a local server) the answer is
 * held back until the request's work is done (keepWorkInRequest below).
 */
const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');
const requestWork = new AsyncLocalStorage<Promise<unknown>[]>();

/** The longest an answer waits for its work; anything slower carries on without it. */
export const MAX_WAIT_MS = 15_000;

/** True where an answer waits for its background work, so long jobs must be kept short. */
export const answerWaitsForWork = (env: Record<string, string | undefined> = process.env) => !env.VERCEL;

export const background = (task: Promise<unknown>) => {
    const safe = task.catch((err) => console.error('Background task failed:', err?.message ?? err));
    const context = (globalThis as any)[REQUEST_CONTEXT]?.get?.();
    if (context?.waitUntil) context.waitUntil(safe);
    else requestWork.getStore()?.push(safe);
};

/** Express middleware: off Vercel, holds each answer until the work it started has finished. */
export const keepWorkInRequest = (_req: Request, res: Response, next: NextFunction) => {
    if (!answerWaitsForWork()) return next();
    const work: Promise<unknown>[] = [];
    const end = res.end;
    res.end = function (this: Response, ...args: unknown[]) {
        if (!work.length) return (end as Function).apply(this, args);
        const timeout = new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS).unref());
        Promise.race([Promise.allSettled(work), timeout]).then(() => (end as Function).apply(this, args));
        return this;
    } as typeof res.end;
    requestWork.run(work, next);
};
