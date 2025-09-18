import React from 'react';
import { ClerkProvider, SignIn, SignUp, UserButton } from '@clerk/clerk-react';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

if (!clerkPublishableKey) {
  console.warn('VITE_CLERK_PUBLISHABLE_KEY is not set. ChittyAuth will not function properly.');
}

interface ChittyAuthProviderProps {
  children: React.ReactNode;
}

export function ChittyAuthProvider({ children }: ChittyAuthProviderProps) {
  // If no Clerk key, just render children without provider
  if (!clerkPublishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: '#F59E0B', // chitty-gold
          colorBackground: '#111827', // chitty-dark
          colorText: '#F3F4F6',
          colorTextSecondary: '#9CA3AF',
          colorDanger: '#EF4444',
          colorSuccess: '#10B981',
          colorWarning: '#F59E0B',
          colorInputBackground: '#1F2937',
          colorInputText: '#F3F4F6',
          borderRadius: '0.5rem',
        },
        elements: {
          formButtonPrimary:
            'bg-chitty-gold hover:bg-chitty-gold/90 text-chitty-dark',
          card: 'bg-chitty-dark border-chitty-charcoal',
          headerTitle: 'text-chitty-platinum',
          headerSubtitle: 'text-gray-400',
          socialButtonsBlockButton:
            'bg-chitty-charcoal hover:bg-chitty-charcoal/80 text-chitty-platinum border-chitty-charcoal',
          formFieldLabel: 'text-chitty-platinum',
          formFieldInput:
            'bg-chitty-charcoal border-chitty-charcoal text-chitty-platinum placeholder:text-gray-500',
          footerActionLink: 'text-chitty-gold hover:text-chitty-gold/80',
          identityPreviewText: 'text-chitty-platinum',
          identityPreviewEditButtonIcon: 'text-chitty-gold',
        },
        layout: {
          socialButtonsPlacement: 'bottom',
          socialButtonsVariant: 'blockButton',
        },
        signIn: {
          baseTheme: undefined,
        },
        signUp: {
          baseTheme: undefined,
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}

export { SignIn as ChittySignIn, SignUp as ChittySignUp, UserButton as ChittyUserButton };