import { apiClient, type Schemas } from './openapi/client';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function unwrap<T>(promise: Promise<{ data?: T; response: Response }>): Promise<T> {
  const { data, response } = await promise;
  if (!response.ok) {
    const body: unknown = await response.clone().json().catch(() => null);
    const message =
      (body && typeof body === 'object' && 'message' in body
        ? String((body as { message?: unknown }).message ?? '')
        : '') || response.statusText;
    throw new ApiError(response.status, message);
  }
  return data as T;
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

export const userApi = {
  findAll: () => unwrap(apiClient.GET('/users')),
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
};
