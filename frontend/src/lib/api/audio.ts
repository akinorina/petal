import { apiClient, unwrap, type Schemas } from './shared';

export const audioApi = {
  findAll: () => unwrap(apiClient.GET('/audios')),
  findById: (id: string) =>
    unwrap(apiClient.GET('/audios/{id}', { params: { path: { id } } })),
  create: (body: Schemas['CreateAudioRequestDto']) =>
    unwrap(apiClient.POST('/audios', { body })),
  getDownloadUrl: (id: string) =>
    unwrap(
      apiClient.GET('/audios/{id}/download-url', {
        params: { path: { id } },
      }),
    ),
  remove: async (id: string): Promise<void> => {
    await unwrap(
      apiClient.DELETE('/audios/{id}', { params: { path: { id } } }),
    );
  },
};
