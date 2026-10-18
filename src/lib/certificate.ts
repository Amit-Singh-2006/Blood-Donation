import { apiFetch } from './api';
import { saveFile } from './files';

/** A donor's certificate for one donation, from POST /donor/certificates. */
export interface Certificate {
  code: string;
  donor_name: string;
  hospital_name: string;
  hospital_city: string | null;
  /** YYYY-MM-DD */
  donated_on: string;
  issued_at: string;
  /** The public page that confirms the certificate is real */
  verify_url: string;
}

/** What anyone checking a code sees, from GET /certificates/:code. */
export interface CertificateCheck {
  valid: boolean;
  code?: string;
  /** First name and initial only */
  donor?: string;
  hospital_name?: string;
  hospital_city?: string | null;
  donated_on?: string;
  message?: string;
}

// Same alphabet as the API: no 0/O or 1/I/L to misread on paper
export const CERTIFICATE_CODE = /^LC-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

/** "lc abcd 2345" → "LC-ABCD-2345", for codes typed from a printed certificate. */
export const normaliseCode = (typed: string): string => {
  const chars = typed.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^LC/, '');
  return chars.length === 8 ? `LC-${chars.slice(0, 4)}-${chars.slice(4)}` : typed.trim().toUpperCase();
};

/** The certificate of one of the donor's donations; asking again returns the same one. */
export const requestCertificate = (donation: { donation_id: number } | { match_id: number }): Promise<Certificate> =>
  apiFetch('/donor/certificates', { method: 'POST', body: JSON.stringify(donation) });

/** "2026-10-17" → "17 October 2026", the same everywhere. */
export const certificateDay = (day: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day ?? '');
  if (!m) return day ?? '';
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export const hospitalPlace = (c: { hospital_name?: string; hospital_city?: string | null }): string =>
  [c.hospital_name, c.hospital_city].filter(Boolean).join(', ');

export const certificateFileName = (c: { code: string }) => `LifeLink-certificate-${c.code}.pdf`;

// ── The PDF ───────────────────────────────────────────────────────────────

// A4 landscape at 150 dpi. Drawn by the browser, so names in any script print correctly.
const W = 1754;
const H = 1240;
const MM = 297 / W;
const RED = '#ee2b2b';
const INK = '#0f172a';
const BODY = '#334155';
const MUTED = '#64748b';
const PALE = '#fbd5d5';
const FONT = '"Manrope", "Inter", system-ui, sans-serif';
const QR = { x: W - 150 - 210, y: 900, size: 210 };

const setFont = (ctx: CanvasRenderingContext2D, weight: number, size: number) => { ctx.font = `${weight} ${size}px ${FONT}`; };

/** Shrinks the font until the text fits on one line. */
const fitFont = (ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number, minSize: number) => {
  for (let s = size; s >= minSize; s -= 2) {
    setFont(ctx, weight, s);
    if (ctx.measureText(text).width <= maxWidth) return;
  }
};

/** Breaks text into lines no wider than maxWidth, at ordinary spaces only. */
const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/[ \t\n]+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const drawDrop = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x, y - 1.7 * r);
  ctx.quadraticCurveTo(x + 1.05 * r, y - 0.55 * r, x + r, y);
  ctx.arc(x, y, r, 0, Math.PI);
  ctx.quadraticCurveTo(x - 1.05 * r, y - 0.55 * r, x, y - 1.7 * r);
  ctx.fill();
};

/** The certificate as an image; `qr` is the page's QR code canvas for verify_url. */
export const drawCertificate = async (c: Certificate, qr: HTMLCanvasElement | null): Promise<HTMLCanvasElement> => {
  await Promise.all(['800 60px Manrope', '600 30px Manrope', '500 30px Manrope']
    .map((f) => document.fonts?.load(f).catch(() => undefined)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the certificate.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 14;
  ctx.strokeRect(44, 44, W - 88, H - 88);
  ctx.strokeStyle = PALE;
  ctx.lineWidth = 3;
  ctx.strokeRect(74, 74, W - 148, H - 148);

  // LifeLink, with a drop
  ctx.textAlign = 'center';
  setFont(ctx, 800, 56);
  const brand = ctx.measureText('LifeLink').width;
  ctx.fillStyle = RED;
  ctx.fillText('LifeLink', W / 2 + 26, 200);
  drawDrop(ctx, W / 2 - brand / 2 - 14, 186, 17);

  ctx.fillStyle = MUTED;
  setFont(ctx, 700, 28);
  ctx.fillText('CERTIFICATE OF APPRECIATION', W / 2, 282);
  setFont(ctx, 500, 32);
  ctx.fillText('This certificate is presented to', W / 2, 410);

  ctx.fillStyle = INK;
  fitFont(ctx, c.donor_name, 800, 96, W - 420, 44);
  ctx.fillText(c.donor_name, W / 2, 540);
  ctx.strokeStyle = PALE;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 480, 585);
  ctx.lineTo(W / 2 + 480, 585);
  ctx.stroke();

  ctx.fillStyle = BODY;
  // The date stays on one line
  const sentence = `for voluntarily donating blood at ${hospitalPlace(c)} on ${certificateDay(c.donated_on).replace(/ /g, '\u00a0')}.`;
  let body: string[] = [];
  for (let size = 36; size >= 26 && (!body.length || body.length > 3); size -= 2) {
    setFont(ctx, 500, size);
    body = wrap(ctx, sentence, 1240);
  }
  body = body.slice(0, 3);
  body.forEach((line, i) => ctx.fillText(line, W / 2, 670 + i * 54));
  ctx.fillStyle = RED;
  setFont(ctx, 700, 30);
  ctx.fillText('One donation can help up to three patients. Thank you.', W / 2, 690 + body.length * 54 + 16);

  // The code, and where to check it
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  setFont(ctx, 700, 22);
  ctx.fillText('CERTIFICATE CODE', 150, 960);
  ctx.fillStyle = INK;
  setFont(ctx, 800, 40);
  ctx.fillText(c.code, 150, 1010);
  ctx.fillStyle = MUTED;
  setFont(ctx, 500, 22);
  const check = wrap(ctx, `Check that it is real: scan the code, or open ${c.verify_url.replace(/^https?:\/\//, '')}`, QR.x - 210);
  check.slice(0, 2).forEach((line, i) => ctx.fillText(line, 150, 1056 + i * 32));
  ctx.fillText(`Issued by LifeLink on ${certificateDay(c.issued_at)}. The hospital recorded this donation on LifeLink.`, 150, 1056 + Math.min(check.length, 2) * 32 + 10);

  if (qr) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, QR.x, QR.y, QR.size, QR.size);
  }
  return canvas;
};

/** Draws the certificate as a PDF and saves it (Downloads › LifeLink in the app). */
export const downloadCertificate = async (c: Certificate, qr: HTMLCanvasElement | null): Promise<void> => {
  const canvas = await drawCertificate(c, qr);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: `LifeLink certificate ${c.code}`, subject: `Blood donation on ${c.donated_on}`, author: 'LifeLink', creator: 'LifeLink' });
  pdf.addImage(canvas, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
  // Tapping the QR code in the PDF opens the check page too
  if (qr) pdf.link(QR.x * MM, QR.y * MM, QR.size * MM, QR.size * MM, { url: c.verify_url });
  await saveFile(pdf.output('blob'), certificateFileName(c));
};
