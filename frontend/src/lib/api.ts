import { apiClient, type Schemas } from './openapi/client';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function unwrap<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await promise;
  if (!response.ok) {
    // openapi-fetch はレスポンスボディを既に消費しているため、
    // response.clone() は使わず、パース済みの error からメッセージを取り出す。
    const message = messageFromError(error) || response.statusText || 'リクエストに失敗しました';
    throw new ApiError(response.status, message);
  }
  return data as T;
}

function messageFromError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

export const imageApi = {
  findAll: () => unwrap(apiClient.GET('/images')),
  findById: (id: string) =>
    unwrap(apiClient.GET('/images/{id}', { params: { path: { id } } })),
  create: (body: Schemas['CreateImageRequestDto']) =>
    unwrap(apiClient.POST('/images', { body })),
  getDownloadUrl: (id: string) =>
    unwrap(
      apiClient.GET('/images/{id}/download-url', {
        params: { path: { id } },
      }),
    ),
  remove: async (id: string): Promise<void> => {
    await unwrap(
      apiClient.DELETE('/images/{id}', { params: { path: { id } } }),
    );
  },
};

export async function uploadToPresignedUrl(
  url: string,
  file: File,
  contentType: string,
): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `アップロードに失敗しました (${res.status})`);
  }
}

export const mfaApi = {
  setup: () => unwrap(apiClient.POST('/auth/mfa/setup')),
  verify: async (code: string): Promise<void> => {
    await unwrap(apiClient.POST('/auth/mfa/verify', { body: { code } }));
  },
  disable: async (): Promise<void> => {
    await unwrap(apiClient.POST('/auth/mfa/disable'));
  },
};

export const authApi = {
  changePassword: async (
    body: Schemas['ChangePasswordRequestDto'],
  ): Promise<void> => {
    await unwrap(apiClient.POST('/auth/change-password', { body }));
  },
};

export const auditLogApi = {
  findAll: (params: { limit: number; offset: number }) =>
    unwrap(
      apiClient.GET('/audit-logs', {
        params: {
          query: {
            limit: params.limit,
            offset: params.offset,
          },
        },
      }),
    ),
};

export const userApi = {
  findMe: () => unwrap(apiClient.GET('/users/me')),
  updateMyProfile: (body: Schemas['UpdateMyProfileRequestDto']) =>
    unwrap(apiClient.PATCH('/users/me', { body })),
  findPage: (params: {
    limit: number;
    offset: number;
    q?: string;
    role?: 'admin' | 'user';
    deleted?: boolean;
  }) =>
    unwrap(
      apiClient.GET('/users', {
        params: {
          query: {
            limit: params.limit,
            offset: params.offset,
            ...(params.q ? { q: params.q } : {}),
            ...(params.role ? { role: params.role } : {}),
            deleted: params.deleted ? 'true' : 'false',
          },
        },
      }),
    ),
  findById: (id: string) =>
    unwrap(apiClient.GET('/users/{id}', { params: { path: { id } } })),
  create: (body: Schemas['CreateUserRequestDto']) =>
    unwrap(apiClient.POST('/users', { body })),
  update: (id: string, body: Schemas['UpdateUserRequestDto']) =>
    unwrap(
      apiClient.PATCH('/users/{id}', { params: { path: { id } }, body }),
    ),
  remove: async (id: string): Promise<void> => {
    await unwrap(apiClient.DELETE('/users/{id}', { params: { path: { id } } }));
  },
  restore: (id: string) =>
    unwrap(
      apiClient.POST('/users/{id}/restore', { params: { path: { id } } }),
    ),
  requestEmailChange: async (email: string): Promise<void> => {
    await unwrap(
      apiClient.PATCH('/users/me/email', { body: { email } }),
    );
  },
  confirmEmailChange: async (code: string): Promise<void> => {
    await unwrap(
      apiClient.POST('/users/me/email/verify', { body: { code } }),
    );
  },
};
