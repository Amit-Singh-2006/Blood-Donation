/** Wording of the campaign invitations and the account emails. */

const esc = (s: unknown) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));

export interface CampaignDetails {
    name: string;
    city: string;
    venue: string;
    address?: string | null;
    when: string;
    rewards?: string | null;
    refreshments?: string | null;
    contact_phone?: string | null;
    description?: string | null;
}

export interface CampaignRecipient {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
}

export const MAX_CAMPAIGN_RECIPIENTS = 5000;

/** One SMS/WhatsApp text and one email per donor. */
export const campaignMessages = (c: CampaignDetails, registerUrl: string, recipients: CampaignRecipient[]) => {
    const where = c.venue + (c.address ? ', ' + c.address : '') + ', ' + c.city;
    const extras: string[] = [];
    if (c.rewards) extras.push('Rewards: ' + c.rewards);
    if (c.refreshments) extras.push('Refreshments: ' + c.refreshments);
    return recipients.slice(0, MAX_CAMPAIGN_RECIPIENTS).map((r) => {
        const first = String(r.name || 'there').split(' ')[0];
        const text = 'LifeLink: Blood donation camp "' + c.name + '" in ' + c.city + ', ' + c.when + ' at ' + where + '. '
            + (extras.length ? extras.join('. ') + '. ' : '') + 'Register: ' + registerUrl;
        const html = '<p>Hi ' + esc(first) + ',</p><p>You are invited to <b>' + esc(c.name) + '</b>, a blood donation camp in ' + esc(c.city) + '.</p>'
            + '<p><b>When:</b> ' + esc(c.when) + '<br><b>Where:</b> ' + esc(where) + (extras.length ? '<br>' + extras.map(esc).join('<br>') : '')
            + (c.contact_phone ? '<br><b>Contact:</b> ' + esc(c.contact_phone) : '') + '</p>'
            + (c.description ? '<p>' + esc(c.description) + '</p>' : '')
            + '<p><a href="' + esc(registerUrl) + '">Register for the camp</a></p><p>One donation can save up to three lives. Thank you!<br>LifeLink</p>';
        return {
            name: r.name || '',
            phone: r.phone || '',
            email: r.email || '',
            sms_text: text,
            email_subject: 'Blood donation camp: ' + c.name + ' (' + c.city + ')',
            email_html: html,
        };
    });
};

export interface AccountEmail {
    type: 'reset_code' | 'password_changed';
    to: string;
    name: string;
    code?: string;
    minutes?: number;
    needs_authenticator?: boolean;
    when?: string;
}

/**
 * A password reset code, or the notice that the password was changed (sent
 * after every reset, so a stranger's reset is noticed).
 */
export const accountEmail = (body: AccountEmail) => {
    const to = String(body.to || '').trim();
    if (!/^[^ @]+@[^ @]+[.][^ @]+$/.test(to)) throw new Error('A valid recipient email is required');
    const first = esc(String(body.name || 'there').trim().split(' ')[0]);
    const frame = (inner: string) => '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">'
        + '<p style="font-size:20px;font-weight:800;margin:0 0 16px">Life<span style="color:#ee2b2b">Link</span></p>' + inner
        + '<p style="font-size:12px;color:#64748b;margin-top:24px">LifeLink blood donation network</p></div>';

    if (body.type === 'reset_code') {
        const code = String(body.code || '');
        if (!/^[0-9]{6}$/.test(code)) throw new Error('A 6-digit code is required');
        const minutes = Number(body.minutes) || 15;
        return {
            to,
            subject: 'Your LifeLink password reset code',
            html: frame('<p>Hi ' + first + ',</p><p>Use this code to reset your LifeLink password:</p>'
                + '<p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#ee2b2b;background:#fef2f2;border:1px solid #fee2e2;border-radius:12px;padding:12px;text-align:center">' + code + '</p>'
                + '<p>It works once, for ' + minutes + ' minutes.' + (body.needs_authenticator ? ' You will also need the code from your authenticator app.' : '') + '</p>'
                + '<p style="color:#64748b">Did not ask for this? Ignore this email: your password stays the same. Never share this code. LifeLink staff will never ask for it.</p>'),
        };
    }
    if (body.type === 'password_changed') {
        return {
            to,
            subject: 'Your LifeLink password was changed',
            html: frame('<p>Hi ' + first + ',</p><p>Your LifeLink password was changed' + (body.when ? ' on ' + esc(body.when) + ' (IST)' : '') + ', and you were signed out on every device.</p>'
                + '<p>If this was you, there is nothing else to do.</p>'
                + '<p style="color:#b91c1c;font-weight:700">If it was not you, reset your password again straight away from the sign-in page, and tell your LifeLink admin.</p>'),
        };
    }
    throw new Error('Unknown email type: ' + String(body.type));
};
