import { apiClient, unwrap, type Schemas } from './shared';

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
    unwrap(apiClient.PATCH('/users/{id}', { params: { path: { id } }, body })),
  remove: async (id: string): Promise<void> => {
    await unwrap(apiClient.DELETE('/users/{id}', { params: { path: { id } } }));
  },
  restore: (id: string) =>
    unwrap(apiClient.POST('/users/{id}/restore', { params: { path: { id } } })),
  resendInvite: async (id: string): Promise<void> => {
    await unwrap(
      apiClient.POST('/users/{id}/resend-invite', {
        params: { path: { id } },
      }),
    );
  },
  requestEmailChange: async (email: string): Promise<void> => {
    await unwrap(apiClient.PATCH('/users/me/email', { body: { email } }));
  },
  confirmEmailChange: async (code: string): Promise<void> => {
    await unwrap(apiClient.POST('/users/me/email/verify', { body: { code } }));
  },
};
