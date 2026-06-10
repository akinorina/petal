import { ApiError, apiClient, unwrap, type Schemas } from './shared';

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
