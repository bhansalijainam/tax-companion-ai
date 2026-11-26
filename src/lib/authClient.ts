import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';

/** Same-origin client for the practice workspace (server: server/auth.ts). */
export const authClient = createAuthClient({ plugins: [organizationClient()] });

export interface Me {
  userId: string;
  email: string;
  firmId: string;
  role: 'partner' | 'preparer';
}

/** Firm membership as the server sees it (null when signed out or without a firm). */
export async function fetchMe(): Promise<{ member: Me | null; status: number }> {
  const res = await fetch('/api/me', { credentials: 'include' });
  if (!res.ok) return { member: null, status: res.status };
  const body = await res.json();
  return { member: body.member, status: 200 };
}
