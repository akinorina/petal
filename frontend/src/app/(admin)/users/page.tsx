'use client';

import { useState } from 'react';
import { Alert } from '@/design-system/components/Alert';
import { Button } from '@/design-system/components/Button';
import { Card } from '@/design-system/components/Card';
import { Dialog } from '@/design-system/components/Dialog';
import { EmptyState } from '@/design-system/components/EmptyState';
import { FormField } from '@/design-system/components/FormField';
import { Input } from '@/design-system/components/Input';
import { Select } from '@/design-system/components/Select';
import { Tabs } from '@/design-system/components/Tabs';
import { Tag } from '@/design-system/components/Tag';
import { Text } from '@/design-system/components/Text';
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

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as 'active' | 'deleted')}
        className="mb-4"
      >
        <Tabs.List ariaLabel="ユーザーの状態">
          <Tabs.Tab value="active">アクティブ</Tabs.Tab>
          <Tabs.Tab value="deleted">削除済み</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : users.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title="ユーザーがいません"
            description={
              tab === 'active'
                ? 'まだユーザーが登録されていません。「ユーザーを追加」から最初のユーザーを登録しましょう。'
                : '削除済みのユーザーはありません。'
            }
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
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
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{user.nameKana}</td>
                  <td className="px-4 py-3 text-zinc-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <Tag
                      variant={user.role === 'admin' ? 'accent' : 'neutral'}
                      size="sm"
                    >
                      {user.role === 'admin' ? '管理者' : 'ユーザー'}
                    </Tag>
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
              ))}
            </tbody>
          </table>
        </Card>
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
          title="ユーザーを削除"
          message={`「${modal.user.name}」を削除しますか？`}
          onCancel={() => setModal(null)}
          onConfirm={() => handleDelete(modal.user)}
        />
      )}

      {modal?.type === 'restore' && (
        <ConfirmModal
          title="ユーザーを復活"
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
        </Dialog.Header>
        <form onSubmit={handleSubmit}>
          <Dialog.Body>
            <div className="space-y-4">
              {isCreate && (
                <FormField label="メールアドレス" isRequired>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </FormField>
              )}
              <FormField label="氏名" isRequired>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
              <FormField label="ふりがな" isRequired>
                <Input
                  type="text"
                  value={nameKana}
                  onChange={(e) => setNameKana(e.target.value)}
                />
              </FormField>
              <FormField label="ロール" isRequired>
                <Select
                  options={[
                    { value: 'user', label: 'ユーザー' },
                    { value: 'admin', label: '管理者' },
                  ]}
                  value={role}
                  onChange={(v) => setRole(v as 'admin' | 'user')}
                />
              </FormField>

              {error && <Alert variant="danger">{error}</Alert>}
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="secondary" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

// ---- ConfirmModal ----

function ConfirmModal({
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel = '削除する',
  variant = 'danger',
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()} size="sm">
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-sm">{message}</p>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
