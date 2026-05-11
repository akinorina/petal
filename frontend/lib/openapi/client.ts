import createClient, { type Middleware } from 'openapi-fetch';
import { getAccessToken, refreshAccessToken } from '../cognito';
import type { components, paths } from './schema';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

const RETRY_HEADER = 'X-Petal-Retry';

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    let token = await getAccessToken();
    if (!token) {
      token = await refreshAccessToken();
    }
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401) return response;
    if (request.headers.get(RETRY_HEADER)) return response;

    const newToken = await refreshAccessToken();
    if (!newToken) return response;

    const retryRequest = new Request(request, {
      headers: new Headers(request.headers),
    });
    retryRequest.headers.set('Authorization', `Bearer ${newToken}`);
    retryRequest.headers.set(RETRY_HEADER, '1');
    return fetch(retryRequest);
  },
};

export const apiClient = createClient<paths>({ baseUrl: BASE_URL });
apiClient.use(authMiddleware);

export type Schemas = components['schemas'];
