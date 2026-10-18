import { Request, Response } from 'express';
import { isbot } from 'isbot';
import { analytics, replyResponse, respond, tick, tracking, ussd } from '../network/engine';
import { sameToken } from '../network/rules';
import { query } from '../config/db';

const send = (res: Response, r: { status: number; contentType: string; body: string }) =>
    res.status(r.status).set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }).type(r.contentType).send(r.body);

// GET /network/donor-response?m=&t=&a=accept|decline (donor) or ?m=&h=&a=donated|no_show / ?r=&h=&a=cancel (hospital)
export const donorResponse = async (req: Request, res: Response) => {
    // Link previews (WhatsApp, Facebook, Slack…) and link checkers must not answer on the donor's behalf
    if (req.method === 'HEAD' || isbot(req.get('user-agent'))) {
        return res.status(403).set('Cache-Control', 'no-store').type('text/plain').send('Open this link in your browser to answer.');
    }
    try {
        send(res, replyResponse(await respond(req.query as Record<string, unknown>)));
    } catch (err: any) {
        console.error('Donor response failed:', err?.message ?? err);
        res.status(500).set('Cache-Control', 'no-store').json({ outcome: 'error', title: 'Something went wrong', message: 'Please open the link again in a minute.' });
    }
};

// GET /network/request-status?token=&format=json|html: the family's tracking page
export const requestStatus = async (req: Request, res: Response) => {
    try {
        send(res, await tracking(req.query as Record<string, unknown>));
    } catch (err: any) {
        console.error('Tracking failed:', err?.message ?? err);
        res.status(500).json({ status: 'error', message: 'Tracking is unavailable right now.' });
    }
};

// GET /network/analytics?format=json|html
export const analyticsView = async (req: Request, res: Response) => {
    try {
        send(res, await analytics(req.query as Record<string, unknown>));
    } catch (err: any) {
        console.error('Analytics failed:', err?.message ?? err);
        res.status(500).json({ message: 'Network statistics are unavailable right now.' });
    }
};

// POST /network/ussd?key=: callbacks from a USSD gateway (Africa's Talking style)
export const ussdCallback = async (req: Request, res: Response) => {
    res.type('text/plain');
    // The gateway vouches for the caller's number, so only the gateway may call this
    const key = process.env.USSD_GATEWAY_KEY?.trim();
    if (!key) return res.send('END LifeLink USSD is not switched on yet.');
    if (!sameToken(String(req.query.key ?? ''), key)) return res.status(403).send('END Not allowed.');
    try {
        res.send(await ussd(req.body ?? {}));
    } catch (err: any) {
        console.error('USSD failed:', err?.message ?? err);
        res.send('END Sorry, something went wrong. Please try again.');
    }
};

// The timer sends a secret that initDb keeps in app_secrets; cached here for a while
const TICK_SECRET_TTL_MS = 5 * 60 * 1000;
let tickSecret: { value: string | null; at: number } | null = null;
const loadTickSecret = async (fresh: boolean) => {
    if (!fresh && tickSecret && Date.now() - tickSecret.at < TICK_SECRET_TTL_MS) return tickSecret.value;
    const value = (await query(`SELECT value FROM app_secrets WHERE name = 'network_tick'`)).rows[0]?.value ?? null;
    tickSecret = { value, at: Date.now() };
    return value;
};

// POST /network/tick: due escalation rounds and queued messages. Called every
// minute by the database timer, which sends the X-LifeLink-Tick secret; anyone
// else is refused (rounds already run on their own schedule).
export const networkTick = async (req: Request, res: Response) => {
    try {
        const given = req.get('x-lifelink-tick');
        // A miss re-reads the secret once, in case it changed since it was cached
        if (!sameToken(given, await loadTickSecret(false)) && !sameToken(given, await loadTickSecret(true))) {
            return res.status(401).json({ message: 'Not allowed.' });
        }
        res.json(await tick());
    } catch (err: any) {
        console.error('Network tick failed:', err?.message ?? err);
        res.status(500).json({ message: 'The network tick failed.' });
    }
};
