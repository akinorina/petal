// @ts-check
import { serwist } from '@serwist/next/config';

// Serwist configurator モード。`next build` 後に `serwist build` で SW をバンドルし、
// precache マニフェストを注入する。Turbopack（Next 16 の既定）と互換。
export default serwist({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
});
