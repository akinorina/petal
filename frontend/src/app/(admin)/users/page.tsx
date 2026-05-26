'use client';

import { useState } from 'react';
import { Button } from '@/design-system/components/Button/Button';
import { Input } from '@/design-system/components/Input/Input';
import { Text } from '@/design-system/components/Text/Text';
import type { Schemas } from '@/lib/openapi/client';
import { useUsersPage } from './use-users-page';

type User = Schemas['UserResponseDto'];
type CreateUserRequest = Schemas['CreateUserRequestDto'];
type UpdateUserRequest = Schemas['UpdateUserRequestDto'];

export default function UsersPage() {
  const {
    tab,
    setTab,
    users,
    isLoading,
    error,
    modal,
    setModal,
    handleDelete,
    handleRestore,
    handleCreate,
    handleUpdate,
  } = useUsersPage();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Text as="h1" variant="heading-md">ユーザー管理</Text>
        {tab === 'active' && (
          <Button onClick={() => setModal({ type: 'create' })}>
            ユーザーを追加
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-1 border-b border-zinc-200">
        <TabButton active={tab === 'active'} onClick={() => setTab('active')}>
          アクティブ
        </TabButton>
        <TabButton
          active={tab === 'deleted'}
          onClick={() => setTab('deleted')}
        >
          削除済み
        </TabButton>
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
                    <td className="px-4 py-3 text-zinc-500">{user.email}</td>
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
                        {tab === 'active' ? (
                          <>
                            <button
                              onClick={() => setModal({ type: 'edit', user })}
                              className="ds-link ds-link--inline"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => setModal({ type: 'delete', user })}
                              className="ds-link ds-link--inline text-red-500"
                            >
                              削除
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setModal({ type: 'restore', user })}
                            className="ds-link ds-link--inline text-emerald-700"
                          >
                            復活
                          </button>
                        )}
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
          onSubmit={(data) => handleCreate(data as CreateUserRequest)}
        />
      )}

      {modal?.type === 'edit' && (
        <UserFormModal
          title="ユーザーを編集"
          initial={modal.user}
          onClose={() => setModal(null)}
          onSubmit={(data) =>
            handleUpdate(modal.user.id, data as UpdateUserRequest)
          }
        />
      )}

      {modal?.type === 'delete' && (
        <ConfirmModal
          message={`「${modal.user.name}」を削除しますか？`}
          onCancel={() => setModal(null)}
          onConfirm={() => handleDelete(modal.user)}
        />
      )}

      {modal?.type === 'restore' && (
        <ConfirmModal
          message={`「${modal.user.name}」を復活させますか？`}
          confirmLabel="復活する"
          variant="primary"
          onCancel={() => setModal(null)}
          onConfirm={() => handleRestore(modal.user)}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-zinc-900 text-zinc-900'
          : 'border-transparent text-zinc-500 hover:text-zinc-900'
      }`}
    >
      {children}
    </button>
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
  const [email, setEmail] = useState(initial?.email ?? '');
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
        ? { email, name, nameKana, role }
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
          <Field label="メールアドレス">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
        )}
        <Field label="氏名">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label="ふりがな">
          <Input
            type="text"
            value={nameKana}
            onChange={(e) => setNameKana(e.target.value)}
            required
          />
        </Field>
        <Field label="ロール">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
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
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
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
  confirmLabel = '削除する',
  variant = 'danger',
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}) {
  return (
    <Overlay onClose={onCancel}>
      <p className="mb-6 text-sm">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          キャンセル
        </Button>
        <Button variant={variant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
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
