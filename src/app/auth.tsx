import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { sendMagicLink, signInWithGoogle } from '@/features/auth/oauth';
import { supabase } from '@/lib/supabase/client';
import { AppText, Button, Input, Screen, spacing } from '@/shared/ui';

type Step = 'email' | 'sent';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Magic-link deep links are handled globally in the root layout (RootNavigator).

  const submitEmail = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setError(null);
    setBusy(true);
    const { error: linkError } = await sendMagicLink(trimmed);
    setBusy(false);
    if (linkError) {
      setError(linkError);
      return;
    }
    setStep('sent');
  };

  const google = async () => {
    setError(null);
    setBusy(true);
    const { error: googleError } = await signInWithGoogle();
    setBusy(false);
    if (googleError) setError(googleError);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <AppText variant="display">{t('common.appName')}</AppText>
            <AppText variant="body" color="secondary">
              {t('auth.tagline')}
            </AppText>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.duration(400).delay(120)} style={styles.form}>
          <Button label={t('auth.googleContinue')} onPress={google} loading={busy} />
          <Button label={t('auth.appleSoon')} onPress={() => {}} variant="secondary" disabled />

          <View style={styles.divider} />

          {step === 'email' ? (
            <>
              <Input
                label={t('auth.emailLabel')}
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                error={error}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <Button
                label={t('auth.sendLink')}
                onPress={submitEmail}
                loading={busy}
                variant="secondary"
              />
            </>
          ) : (
            <>
              <AppText variant="caption" color="secondary" style={styles.sentText}>
                {t('auth.linkSent', { email: email.trim() })}
              </AppText>
              {error ? (
                <AppText variant="caption" color="error" accessibilityRole="alert">
                  {error}
                </AppText>
              ) : null}
              <Button
                label={t('auth.resendLink')}
                onPress={submitEmail}
                loading={busy}
                variant="secondary"
              />
              <Button
                label={t('auth.changeEmail')}
                onPress={() => {
                  setStep('email');
                  setError(null);
                }}
                variant="ghost"
              />
            </>
          )}

          {__DEV__ ? (
            <Button
              label="DEV: anonymous"
              variant="ghost"
              onPress={async () => {
                setBusy(true);
                const { error: anonError } = await supabase.auth.signInAnonymously();
                setBusy(false);
                if (anonError) setError(anonError.message);
              }}
            />
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  form: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  divider: {
    height: spacing.sm,
  },
  sentText: {
    textAlign: 'center',
  },
});
