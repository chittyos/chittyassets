import React from 'react';
import { useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export interface ChittyUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  verification?: {
    email: boolean;
    phone: boolean;
    document: boolean;
    overallStatus: 'verified' | 'pending';
    verificationLevel: number;
  };
}

export function useChittyAuth() {
  const { isLoaded, userId, sessionId, getToken, signOut } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const chittyId = userId ? `chitty_${userId}` : null;

  // Fetch ChittyAuth profile with verification status
  const { data: chittyProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['chittyProfile', chittyId],
    queryFn: async () => {
      if (!chittyId) return null;

      const token = await getToken();
      const response = await fetch('/api/auth/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ChittyAuth profile');
      }

      return response.json() as Promise<ChittyUser>;
    },
    enabled: !!chittyId,
  });

  // Verify identity mutation
  const verifyIdentity = useMutation({
    mutationFn: async (method: 'email' | 'phone') => {
      const token = await getToken();
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ method }),
      });

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Verification initiated',
        description: 'Please check your email or phone for verification instructions.',
      });
      queryClient.invalidateQueries({ queryKey: ['chittyProfile'] });
    },
    onError: () => {
      toast({
        title: 'Verification failed',
        description: 'Could not initiate verification. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Get verification status
  const { data: verificationStatus } = useQuery({
    queryKey: ['verificationStatus', chittyId],
    queryFn: async () => {
      if (!chittyId) return null;

      const token = await getToken();
      const response = await fetch('/api/auth/verification-status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch verification status');
      }

      return response.json();
    },
    enabled: !!chittyId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<ChittyUser>) => {
      const token = await getToken();
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Profile updated',
        description: 'Your ChittyID profile has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['chittyProfile'] });
    },
    onError: () => {
      toast({
        title: 'Update failed',
        description: 'Could not update your profile. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const isAuthenticated = !!userId && !!sessionId;
  const isVerified = verificationStatus?.overallStatus === 'verified';
  const verificationLevel = verificationStatus?.verificationLevel || 0;

  return {
    // Auth state
    isLoaded,
    isAuthenticated,
    isVerified,
    verificationLevel,

    // User data
    chittyId,
    clerkUserId: userId,
    sessionId,
    user: chittyProfile,
    clerkUser,

    // Verification
    verificationStatus,
    verifyIdentity: verifyIdentity.mutate,
    isVerifying: verifyIdentity.isPending,

    // Profile management
    updateProfile: updateProfile.mutate,
    isUpdatingProfile: updateProfile.isPending,

    // Actions
    signOut,
    getToken,

    // Loading states
    isLoading: !isLoaded || profileLoading,
  };
}

// Hook for requiring authentication
export function useRequireAuth() {
  const { isAuthenticated, isLoaded } = useChittyAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  React.useEffect(() => {
    if (isLoaded && !isAuthenticated) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to access this page.',
        variant: 'destructive',
      });
      navigate('/sign-in');
    }
  }, [isAuthenticated, isLoaded, navigate, toast]);

  return { isAuthenticated, isLoaded };
}

// Hook for requiring verified ChittyID
export function useRequireVerified() {
  const { isVerified, isLoaded, verificationStatus } = useChittyAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  React.useEffect(() => {
    if (isLoaded && !isVerified && verificationStatus) {
      toast({
        title: 'Verification required',
        description: 'Please verify your ChittyID to access this feature.',
        variant: 'destructive',
      });
      navigate('/verify');
    }
  }, [isVerified, isLoaded, verificationStatus, navigate, toast]);

  return { isVerified, isLoaded, verificationStatus };
}

// Export convenient status checks
export function useChittyAuthStatus() {
  const auth = useChittyAuth();

  return {
    isGuest: !auth.isAuthenticated,
    isBasicUser: auth.isAuthenticated && !auth.isVerified,
    isVerifiedUser: auth.isAuthenticated && auth.isVerified,
    isPremiumUser: auth.isAuthenticated && auth.verificationLevel >= 3,
    verificationLevel: auth.verificationLevel,
  };
}