/**
 * One password rule for every screen that sets a new password (reset, register, society sign-up,
 * change password). Rule keys match the `forgot.rule*` i18n strings, so `t(`forgot.${key}`)` is the message.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES = [
  { key: 'ruleLength', test: (p: string) => p.length >= PASSWORD_MIN_LENGTH },
  { key: 'ruleNumber', test: (p: string) => /\d/.test(p) },
  { key: 'ruleUppercase', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'ruleSpecial', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export type PasswordRuleKey = (typeof PASSWORD_RULES)[number]['key'];

/** Each rule with whether the password passes it (for a live checklist). */
export function passwordRuleState(pw: string): { key: PasswordRuleKey; ok: boolean }[] {
  return PASSWORD_RULES.map((r) => ({ key: r.key, ok: r.test(pw) }));
}

/** The first rule the new password fails, or null when it is strong enough. Message: t(`forgot.${key}`). */
export function validateNewPassword(pw: string): PasswordRuleKey | null {
  return PASSWORD_RULES.find((r) => !r.test(pw))?.key ?? null;
}
