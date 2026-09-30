/**
 * Donation pass: the ID (and QR) a donor shows at the hospital gate after
 * saying YES. The network derives it from the donor's private link token, so
 * it identifies the donor who accepted without exposing that token.
 */
const PASS_IN_TEXT = /LP[\s-]*([A-Z0-9]{4})[\s-]*([A-Z0-9]{4})/;

/** What the QR code carries. The prefix keeps other QR codes from matching. */
export const passQrValue = (code: string) => `LIFELINK-PASS:${code}`;

/**
 * The pass ID in whatever was scanned or typed: case, spaces and dashes do not
 * matter, and a bare 8-character code is accepted too. Null if there is none.
 */
export const extractPassCode = (input: string): string | null => {
  const upper = input.toUpperCase();
  const m = upper.match(PASS_IN_TEXT);
  if (m) return `LP-${m[1]}-${m[2]}`;
  const bare = upper.replace(/[\s-]/g, '');
  return /^[A-Z0-9]{8}$/.test(bare) ? `LP-${bare.slice(0, 4)}-${bare.slice(4)}` : null;
};
