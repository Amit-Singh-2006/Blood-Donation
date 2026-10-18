/**
 * Whether the API runs on a hosting platform rather than on a developer's
 * machine: Vercel sets VERCEL, and Google Cloud Run sets K_SERVICE in every
 * container. Both sit behind a proxy that puts the visitor's address in
 * X-Forwarded-For, and both may run several copies of the API at once.
 */
export const onHosting = (env: Record<string, string | undefined> = process.env): boolean => !!(env.VERCEL || env.K_SERVICE);
