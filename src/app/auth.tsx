import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { supabase } from '@/lib/supabase/client';
import { AppText, Button, Input, Screen, spacing } from '@/shared/ui';

type Step = 'email' | 'code';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setError(null);
    setBusy(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ email: trimmed });
    setBusy(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setStep('code');
  };

  const verifyCode = async () => {
    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (verifyError) {
      setError(t('auth.invalidCode'));
    }
    // success: AuthProvider picks up the session, router guard swaps stacks
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
                autoFocus
              />
              <Button label={t('auth.sendCode')} onPress={sendCode} loading={busy} />
            </>
          ) : (
            <>
              <AppText variant="caption" color="secondary">
                {t('auth.codeSent', { email: email.trim() })}
              </AppText>
              <Input
                label={t('auth.codeLabel')}
                value={code}
                onChangeText={setCode}
                error={error}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
              />
              <Button
                label={t('auth.verify')}
                onPress={verifyCode}
                loading={busy}
                disabled={code.trim().length < 6}
              />
              <Button
                label={t('auth.changeEmail')}
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                }}
                variant="ghost"
              />
            </>
          )}

          <View style={styles.divider} />
          {/* Native Google/Apple sign-in lands with the dev client (Phase 1 tail) */}
          <Button label={t('auth.googleSoon')} onPress={() => {}} variant="secondary" disabled />
          <Button label={t('auth.appleSoon')} onPress={() => {}} variant="secondary" disabled />
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
    height: spacing.lg,
  },
});
