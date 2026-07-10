import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase/client';

// Completes a pending browser auth session on web (no-op on native).
WebBrowser.maybeCompleteAuthSession();

/** Where OAuth/magic-link redirects land: exp://… in Expo Go, streekfit://… in dev client. */
export const authRedirectTo = makeRedirectUri({ path: 'auth/callback' });

/**
 * Turns a redirect URL from Supabase (OAuth callback or email link) into a session.
 * Handles both PKCE (`?code=`) and implicit (`#access_token=…&refresh_token=…`) forms.
 */
export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { code, access_token: accessToken, refresh_token: refreshToken } = params;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return data.session;
  }

  return null;
}

/** Browser-based Google OAuth — works in Expo Go; native flow arrives with the dev client. */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectTo, skipBrowserRedirect: true },
  });
  if (error) return { error: error.message };

  // showInRecents: Android Custom Tab survives app switching mid-login
  const result = await WebBrowser.openAuthSessionAsync(data.url, authRedirectTo, {
    showInRecents: true,
  });
  if (result.type === 'success') {
    try {
      await createSessionFromUrl(result.url);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }
  // user closed the browser — not an error worth showing
  return { error: null };
}

/** Email magic link (free tier can't send OTP codes — link only). */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authRedirectTo },
  });
  return { error: error?.message ?? null };
}
