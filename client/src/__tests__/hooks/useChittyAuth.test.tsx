import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChittyAuth } from '@/hooks/useChittyAuth';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useToast } from '@/hooks/use-toast';
import React from 'react';

// Mock Clerk hooks
vi.mock('@clerk/clerk-react', () => ({
  useAuth: vi.fn(),
  useUser: vi.fn(),
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

// Mock wouter
vi.mock('wouter', () => ({
  useLocation: vi.fn(() => ['/dashboard', vi.fn()]),
}));

// Mock fetch
global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useChittyAuth', () => {
  const mockAuth = useAuth as Mock;
  const mockUser = useUser as Mock;
  const mockToast = useToast as Mock;
  const mockFetch = fetch as Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockAuth.mockReturnValue({
      isLoaded: true,
      userId: 'user_123',
      sessionId: 'session_123',
      getToken: vi.fn().mockResolvedValue('mock-token'),
      signOut: vi.fn(),
    });

    mockUser.mockReturnValue({
      user: {
        id: 'user_123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        firstName: 'John',
        lastName: 'Doe',
        imageUrl: 'https://example.com/avatar.jpg',
      },
    });

    mockToast.mockReturnValue({
      toast: vi.fn(),
    });
  });

  it('should return authenticated state when user is loaded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'chitty_user_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        verification: {
          email: true,
          phone: false,
          document: false,
          overallStatus: 'pending',
          verificationLevel: 1,
        },
      }),
    });

    const { result } = renderHook(() => useChittyAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.chittyId).toBe('chitty_user_123');

    await waitFor(() => {
      expect(result.current.chittyProfile).toBeDefined();
    });

    expect(result.current.chittyProfile?.verification?.overallStatus).toBe('pending');
  });

  it('should return unauthenticated state when user is not loaded', () => {
    mockAuth.mockReturnValue({
      isLoaded: true,
      userId: null,
      sessionId: null,
      getToken: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => useChittyAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.chittyId).toBeNull();
    expect(result.current.chittyProfile).toBeUndefined();
  });

  it('should handle profile fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useChittyAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isAuthenticated).toBe(true);

    await waitFor(() => {
      expect(result.current.profileError).toBeDefined();
    });
  });

  it('should return loading state when auth is not loaded', () => {
    mockAuth.mockReturnValue({
      isLoaded: false,
      userId: null,
      sessionId: null,
      getToken: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => useChittyAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should provide user profile information', () => {
    const { result } = renderHook(() => useChittyAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.user).toEqual({
      id: 'user_123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      imageUrl: 'https://example.com/avatar.jpg',
    });
  });

  it('should handle sign out correctly', async () => {
    const mockSignOut = vi.fn().mockResolvedValue(undefined);
    mockAuth.mockReturnValue({
      isLoaded: true,
      userId: 'user_123',
      sessionId: 'session_123',
      getToken: vi.fn().mockResolvedValue('mock-token'),
      signOut: mockSignOut,
    });

    const { result } = renderHook(() => useChittyAuth(), {
      wrapper: createWrapper(),
    });

    await result.current.signOut();

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should fetch profile with correct headers', async () => {
    const mockGetToken = vi.fn().mockResolvedValue('test-token');
    mockAuth.mockReturnValue({
      isLoaded: true,
      userId: 'user_123',
      sessionId: 'session_123',
      getToken: mockGetToken,
      signOut: vi.fn(),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'chitty_user_123',
        email: 'test@example.com',
      }),
    });

    renderHook(() => useChittyAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/profile', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      });
    });
  });

  it('should handle verification level updates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'chitty_user_123',
        verification: {
          email: true,
          phone: true,
          document: true,
          overallStatus: 'verified',
          verificationLevel: 3,
        },
      }),
    });

    const { result } = renderHook(() => useChittyAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.chittyProfile?.verification?.verificationLevel).toBe(3);
      expect(result.current.chittyProfile?.verification?.overallStatus).toBe('verified');
    });
  });

  it('should not fetch profile when no chittyId is available', () => {
    mockAuth.mockReturnValue({
      isLoaded: true,
      userId: null,
      sessionId: null,
      getToken: vi.fn(),
      signOut: vi.fn(),
    });

    renderHook(() => useChittyAuth(), {
      wrapper: createWrapper(),
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});