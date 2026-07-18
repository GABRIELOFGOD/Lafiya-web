import { describe, it, expect, vi } from 'vitest';
import { redirect } from 'next/navigation';
import { signIn } from '@/app/(auth)/signin/actions';

// Mock supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
    },
  })),
}));

// Mock redirect
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('signIn server action', () => {
  it('rejects invalid email and password', async () => {
    const formData = new FormData();
    formData.set('email', 'invalid-email');
    formData.set('password', '');
    const result = await signIn(undefined, formData);
    expect(result?.error).toBe('Enter a valid email address');
  });

  it('returns error on incorrect credentials', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    createClient().auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    const formData = new FormData();
    formData.set('email', 'wrong@example.com');
    formData.set('password', 'wrongPassword');
    const result = await signIn(undefined, formData);
    expect(result?.error).toBe('Incorrect email or password.');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects on successful sign‑in', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    createClient().auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'validPassword123');
    const result = await signIn(undefined, formData);
    expect(result).toBeUndefined();
    expect(redirect).toHaveBeenCalledWith('/profile');
  });
});
