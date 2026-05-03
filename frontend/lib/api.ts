import { getAccessToken } from './cognito';
import type { CreateUserRequest, UpdateUserRequest, User } from '@/types/user';
import type {
  CreateImageRequest,
  CreateImageResponse,
  DownloadUrlResponse,
  ImageItem,
} from '@/types/image';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const imageApi = {
  findAll: () => request<ImageItem[]>('/images'),
  findById: (id: string) => request<ImageItem>(`/images/${id}`),
  create: (data: CreateImageRequest) =>
    request<CreateImageResponse>('/images', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getDownloadUrl: (id: string) =>
    request<DownloadUrlResponse>(`/images/${id}/download-url`),
  remove: (id: string) =>
    request<void>(`/images/${id}`, { method: 'DELETE' }),
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
  findAll: () => request<User[]>('/users'),
  findById: (id: string) => request<User>(`/users/${id}`),
  create: (data: CreateUserRequest) =>
    request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateUserRequest) =>
    request<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) => request<void>(`/users/${id}`, { method: 'DELETE' }),
};
