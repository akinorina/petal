import { apiClient, unwrap } from './shared';

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
