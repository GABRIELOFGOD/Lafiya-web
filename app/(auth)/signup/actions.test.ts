import { describe, it, expect, vi } from 'vitest';
import { redirect } from 'next/navigation';
import { signUp } from '@/app/(auth)/signup/actions';

// Mock supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: vi.fn(),
    },
  })),
}));

// Mock redirect
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('signUp server action', () => {
  it('rejects invalid email and password', async () => {
    const formData = new FormData();
    formData.set('email', 'invalid-email');
    formData.set('password', 'short');
    const result = await signUp(undefined, formData);
    expect(result?.error).toBe('Enter a valid email address');
  });

  it('redirects on successful sign‑up with session', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    createClient().auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'validPassword123');
    const result = await signUp(undefined, formData);
    expect(result).toBeUndefined();
    expect(redirect).toHaveBeenCalledWith('/profile');
  });

  it('returns info when sign‑up succeeds without session', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    createClient().auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const formData = new FormData();
    formData.set('email', 'user2@example.com');
    formData.set('password', 'validPassword123');
    const result = await signUp(undefined, formData);
    expect(result?.info).toBe('Check your email to confirm your account, then sign in.');
    expect(redirect).not.toHaveBeenCalled();
  });
});
