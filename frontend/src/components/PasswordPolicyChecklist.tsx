'use client';

import { evaluatePassword } from '@/lib/password-policy';

type Props = {
  password: string;
  confirm?: string;
  showMatch?: boolean;
};

export function PasswordPolicyChecklist({
  password,
  confirm,
  showMatch = true,
}: Props) {
  const { rules } = evaluatePassword(password);
  const showMatchRow = showMatch && confirm !== undefined;
  const matchOk = showMatchRow && password.length > 0 && password === confirm;

  return (
    <ul className="space-y-1 rounded-md bg-zinc-50 px-3 py-2 text-xs">
      {rules.map((r) => (
        <Row key={r.key} ok={r.ok} label={r.label} />
      ))}
      {showMatchRow && (
        <Row ok={matchOk} label="新しいパスワードと確認が一致" />
      )}
    </ul>
  );
}

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={`flex items-center gap-2 ${ok ? 'text-green-700' : 'text-zinc-500'}`}
    >
      <span aria-hidden className="inline-block w-3 text-center">
        {ok ? '○' : '×'}
      </span>
      <span>{label}</span>
    </li>
  );
}
