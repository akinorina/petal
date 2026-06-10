import { apiClient, unwrap } from './shared';

export const mfaApi = {
  setup: () => unwrap(apiClient.POST('/auth/mfa/setup')),
  verify: async (code: string): Promise<void> => {
    await unwrap(apiClient.POST('/auth/mfa/verify', { body: { code } }));
  },
  disable: async (): Promise<void> => {
    await unwrap(apiClient.POST('/auth/mfa/disable'));
  },
};
