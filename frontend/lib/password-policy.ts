// Cognito User Pool のパスワードポリシー（docs/14_cognito-user-pool-setup.md §3.5 が正本）。
// 許可記号セットは AWS 公式定義に揃える:
// https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-policies.html

export const PASSWORD_POLICY = {
  minLength: 8,
} as const;

// Cognito が許可する特殊文字。空白も含む。
const SYMBOL_PATTERN = /[\^$*.[\]{}()?"!@#%&/\\,><':;|_~`+= -]/;

export type PasswordRuleKey =
  | 'minLength'
  | 'hasUpper'
  | 'hasLower'
  | 'hasDigit'
  | 'hasSymbol';

export type PasswordRule = {
  key: PasswordRuleKey;
  label: string;
  test: (pw: string) => boolean;
};

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    key: 'minLength',
    label: `${PASSWORD_POLICY.minLength} 文字以上`,
    test: (pw) => pw.length >= PASSWORD_POLICY.minLength,
  },
  {
    key: 'hasUpper',
    label: '大文字 (A-Z) を含む',
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    key: 'hasLower',
    label: '小文字 (a-z) を含む',
    test: (pw) => /[a-z]/.test(pw),
  },
  {
    key: 'hasDigit',
    label: '数字 (0-9) を含む',
    test: (pw) => /[0-9]/.test(pw),
  },
  {
    key: 'hasSymbol',
    label: '記号 (! @ # $ % など) を含む',
    test: (pw) => SYMBOL_PATTERN.test(pw),
  },
];

export type PasswordRuleResult = {
  key: PasswordRuleKey;
  label: string;
  ok: boolean;
};

export type PasswordCheckResult = {
  rules: PasswordRuleResult[];
  allOk: boolean;
};

export function evaluatePassword(password: string): PasswordCheckResult {
  const rules = PASSWORD_RULES.map((r) => ({
    key: r.key,
    label: r.label,
    ok: r.test(password),
  }));
  return {
    rules,
    allOk: rules.every((r) => r.ok),
  };
}

export type PasswordFormCheckResult = {
  rules: PasswordRuleResult[];
  policyOk: boolean;
  match: boolean;
  canSubmit: boolean;
};

export function evaluatePasswordForm(
  password: string,
  confirm: string,
): PasswordFormCheckResult {
  const { rules, allOk } = evaluatePassword(password);
  const match = password.length > 0 && password === confirm;
  return {
    rules,
    policyOk: allOk,
    match,
    canSubmit: allOk && match,
  };
}
