/**
 * Whether the API runs on a hosting platform rather than on a developer's
 * machine. Vercel sets VERCEL and Google Cloud Run sets K_SERVICE in every
 * container; any other host (Antideploy) says so with TRUST_PROXY. All of them
 * put the visitor's address in X-Forwarded-For, and may run several copies of
 * the API at once.
 */
export const onHosting = (env: Record<string, string | undefined> = process.env): boolean =>
    !!(env.VERCEL || env.K_SERVICE || cloudflareMode(env) || proxyHopsSetting(env));

/**
 * Cloudflare's addresses, from https://www.cloudflare.com/ips-v4 and ips-v6
 * (checked 1 November 2026; they rarely change). Antideploy puts Cloudflare in
 * front of Fly.io, whose proxy then reaches the API over its private network.
 */
export const CLOUDFLARE_RANGES = [
    '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
    '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
    '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
    '2a06:98c0::/29', '2c0f:f248::/32',
];

/**
 * Express's "trust proxy" for this host: which proxies may add to
 * X-Forwarded-For, so that req.ip is the visitor and per-address limits (failed
 * sign-ins) apply to each person.
 * - TRUST_PROXY=cloudflare: the host's private network and Cloudflare. The
 *   visitor is the last address that is neither, so it cannot be faked by
 *   writing X-Forwarded-For, even by someone who reaches the host directly.
 * - TRUST_PROXY=<1 to 5>: that many hops, for a host with a fixed proxy chain.
 * - Otherwise one hop (Vercel, Cloud Run).
 * Never "trust every proxy": a visitor could then choose their own address.
 */
export const trustProxySetting = (env: Record<string, string | undefined> = process.env): number | string[] =>
    cloudflareMode(env) ? ['loopback', 'linklocal', 'uniquelocal', ...CLOUDFLARE_RANGES] : proxyHopsSetting(env) ?? 1;

const cloudflareMode = (env: Record<string, string | undefined>) => env.TRUST_PROXY?.trim().toLowerCase() === 'cloudflare';

const proxyHopsSetting = (env: Record<string, string | undefined>): number | undefined => {
    const raw = env.TRUST_PROXY?.trim();
    if (!raw || !/^\d+$/.test(raw)) return undefined;
    const hops = Number(raw);
    return hops >= 1 && hops <= 5 ? hops : undefined;
};
