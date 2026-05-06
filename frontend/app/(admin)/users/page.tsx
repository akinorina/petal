'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, userApi } from '@/lib/api';
import type { Schemas } from '@/lib/openapi/client';

type User = Schemas['UserResponseDto'];
type CreateUserRequest = Schemas['CreateUserRequestDto'];
type UpdateUserRequest = Schemas['UpdateUserRequestDto'];

type Modal =
  | { type: 'create' }
  | { type: 'edit'; user: User }
  | { type: 'delete'; user: User }
  | null;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setError(null);
      const data = await userApi.findAll();
      setUsers(data);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'データの取得に失敗しました',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(user: User) {
    try {
      await userApi.remove(user.id);
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '削除に失敗しました');
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">ユーザー管理</h1>
        <button
          onClick={() => setModal({ type: 'create' })}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ユーザーを追加
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  氏名
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  ふりがな
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  メールアドレス
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  ロール
                </th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600">
                  登録日
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-zinc-400"
                  >
                    ユーザーがいません
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-zinc-500">{user.nameKana}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {user.cognitoSub}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-zinc-900 text-white'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {user.role === 'admin' ? '管理者' : 'ユーザー'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setModal({ type: 'edit', user })}
                          className="text-zinc-500 hover:text-zinc-900"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => setModal({ type: 'delete', user })}
                          className="text-red-400 hover:text-red-600"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === 'create' && (
        <UserFormModal
          title="ユーザーを追加"
          onClose={() => setModal(null)}
          onSubmit={async (data) => {
            await userApi.create(data as CreateUserRequest);
            setModal(null);
            await load();
          }}
        />
      )}

      {modal?.type === 'edit' && (
        <UserFormModal
          title="ユーザーを編集"
          initial={modal.user}
          onClose={() => setModal(null)}
          onSubmit={async (data) => {
            await userApi.update(modal.user.id, data as UpdateUserRequest);
            setModal(null);
            await load();
          }}
        />
      )}

      {modal?.type === 'delete' && (
        <ConfirmModal
          message={`「${modal.user.name}」を削除しますか？`}
          onCancel={() => setModal(null)}
          onConfirm={() => handleDelete(modal.user)}
        />
      )}
    </div>
  );
}

// ---- UserFormModal ----

type UserFormModalProps = {
  title: string;
  initial?: User;
  onClose: () => void;
  onSubmit: (data: CreateUserRequest | UpdateUserRequest) => Promise<void>;
};

function UserFormModal({
  title,
  initial,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const isCreate = !initial;
  const [cognitoSub, setCognitoSub] = useState(initial?.cognitoSub ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [nameKana, setNameKana] = useState(initial?.nameKana ?? '');
  const [role, setRole] = useState<'admin' | 'user'>(initial?.role ?? 'user');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const data = isCreate
        ? { cognitoSub, name, nameKana, role }
        : { name, nameKana, role };
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {isCreate && (
          <Field label="Cognito Sub（メールアドレス）">
            <input
              type="text"
              value={cognitoSub}
              onChange={(e) => setCognitoSub(e.target.value)}
              required
              className={inputClass}
            />
          </Field>
        )}
        <Field label="氏名">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="ふりがな">
          <input
            type="text"
            value={nameKana}
            onChange={(e) => setNameKana(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="ロール">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
            className={inputClass}
          >
            <option value="user">ユーザー</option>
            <option value="admin">管理者</option>
          </select>
        </Field>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            キャンセル
          </button>
          <button type="submit" disabled={isSaving} className={primaryBtnClass}>
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

// ---- ConfirmModal ----

function ConfirmModal({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Overlay onClose={onCancel}>
      <p className="mb-6 text-sm">{message}</p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className={secondaryBtnClass}>
          キャンセル
        </button>
        <button
          onClick={onConfirm}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          削除する
        </button>
      </div>
    </Overlay>
  );
}

// ---- Shared UI ----

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        {children}
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500';
const primaryBtnClass =
  'rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50';
const secondaryBtnClass =
  'rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50';
