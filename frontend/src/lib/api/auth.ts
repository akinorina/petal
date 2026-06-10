import { apiClient, unwrap, type Schemas } from './shared';

export const authApi = {
  changePassword: async (
    body: Schemas['ChangePasswordRequestDto'],
  ): Promise<void> => {
    await unwrap(apiClient.POST('/auth/change-password', { body }));
  },
};
