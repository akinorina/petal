'use client';

import type { ReactNode } from 'react';
import { FloatingTree } from '@floating-ui/react';

export function FloatingTreeProvider({ children }: { children: ReactNode }) {
  return <FloatingTree>{children}</FloatingTree>;
}
