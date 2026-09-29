// Mirrors the backend's password rules so problems show before submitting
export const PASSWORD_RULES: [string, (p: string) => boolean][] = [
  ['At least 8 characters', (p) => p.length >= 8],
  ['An uppercase letter', (p) => /[A-Z]/.test(p)],
  ['A lowercase letter', (p) => /[a-z]/.test(p)],
  ['A number', (p) => /[0-9]/.test(p)],
  ['A special character', (p) => /[^A-Za-z0-9]/.test(p)],
];

export const passwordProblems = (p: string) =>
  PASSWORD_RULES.filter(([, ok]) => !ok(p)).map(([label]) => label.toLowerCase());
