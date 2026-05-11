const DEFAULT_CHITTYAUTH_ORIGIN = 'https://auth.chitty.cc';

function normalizeOrigin(origin: string | undefined): string {
  if (!origin) return DEFAULT_CHITTYAUTH_ORIGIN;
  return origin.replace(/\/+$/, '');
}

export function getChittyAuthOrigin(): string {
  return normalizeOrigin(import.meta.env.VITE_CHITTYAUTH_ORIGIN);
}

export function getReturnToUrl(): string {
  return window.location.origin;
}

function buildAuthUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, `${getChittyAuthOrigin()}/`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export function getSignInUrl(): string {
  return buildAuthUrl('/sign-in', { return_to: getReturnToUrl() });
}

export function getSignUpUrl(): string {
  return buildAuthUrl('/sign-up', { return_to: getReturnToUrl() });
}

export function redirectToSignIn(): void {
  window.location.href = getSignInUrl();
}

export function redirectToSignUp(): void {
  window.location.href = getSignUpUrl();
}

export function getSignOutUrl(): string {
  return buildAuthUrl('/sign-out', { return_to: getReturnToUrl() });
}

export function redirectToSignOut(): void {
  window.location.href = getSignOutUrl();
}
