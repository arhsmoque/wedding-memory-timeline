const PROFANITY_PATTERNS = [
  /f+[\W_]*u+[\W_]*c+[\W_]*k+/i,
  /s+[\W_]*h+[\W_]*i+[\W_]*t+/i,
  /b+[\W_]*i+[\W_]*t+[\W_]*c+[\W_]*h+/i,
  /c+[\W_]*u+[\W_]*n+[\W_]*t+/i,
  /p+[\W_]*u+[\W_]*k+[\W_]*i+/i,
  /p+[\W_]*u+[\W_]*k+[\W_]*i+[\W_]*m+[\W_]*a+[\W_]*k+/i,
  /k+[\W_]*i+[\W_]*m+[\W_]*a+[\W_]*k+/i,
  /l+[\W_]*a+[\W_]*n+[\W_]*c+[\W_]*a+[\W_]*u+/i,
  /\bbabi\b/i,
  /\bbodoh\b/i,
  /\bbangang\b/i,
  /\bsial\b/i,
];

const RESERVED_NAMES = [/^anonymous$/i, /^anon$/i, /^guest$/i, /^test$/i];

export function hasBlockedLanguage(value: string) {
  return PROFANITY_PATTERNS.some((pattern) => pattern.test(value));
}

export function normalizeDisplayText(value: string, max = 500) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function validateDisplayName(raw: string): string {
  const name = normalizeDisplayText(raw, 40);
  if (name.length < 2) throw new Error("Please enter your name before posting.");
  if (/https?:\/\//i.test(name) || /www\./i.test(name)) throw new Error("Please use a name, not a link.");
  if (RESERVED_NAMES.some((pattern) => pattern.test(name))) throw new Error("Please use your real guest name.");
  if (/^(.)\1{4,}$/u.test(name)) throw new Error("Please use a readable guest name.");
  if (hasBlockedLanguage(name)) throw new Error("Please keep the guestbook family-friendly.");
  return name;
}

export function validateGuestText(raw: string, max = 500) {
  const text = normalizeDisplayText(raw, max);
  if (hasBlockedLanguage(text)) throw new Error("Please keep the guestbook family-friendly.");
  return text;
}
