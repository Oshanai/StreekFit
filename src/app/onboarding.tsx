import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase/client';
import { AppText, Button, Card, Chip, Input, Screen, Stepper, spacing } from '@/shared/ui';

type Gender = 'male' | 'female' | 'other';
type Step = 'about' | 'calibration';

/** Comfortable start: ~60% of max effort, but never below the 5-rep set floor. */
function startTarget(calibrationMax: number): number {
  return Math.max(5, Math.round(calibrationMax * 0.6));
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { session, refreshProfile } = useAuth();

  const [step, setStep] = useState<Step>('about');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);

  const [pushups, setPushups] = useState(10);
  const [squats, setSquats] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToCalibration = () => {
    const ageNum = Number(age);
    const nameOk = name.trim().length > 0;
    const ageOk = Number.isInteger(ageNum) && ageNum >= 5 && ageNum <= 120;
    setNameError(nameOk ? null : t('onboarding.nameRequired'));
    setAgeError(ageOk ? null : t('onboarding.ageRequired'));
    if (nameOk && ageOk) setStep('calibration');
  };

  const finish = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);

    const profileUpdate = supabase
      .from('profiles')
      .update({
        name: name.trim(),
        age: Number(age),
        gender,
        country: country.trim() || null,
        city: city.trim() || null,
      })
      .eq('id', session.user.id);

    const targetsUpsert = supabase.from('user_targets').upsert({
      user_id: session.user.id,
      pushup_target: startTarget(pushups),
      squat_target: startTarget(squats),
    });

    const [profileRes, targetsRes] = await Promise.all([profileUpdate, targetsUpsert]);
    if (profileRes.error || targetsRes.error) {
      setBusy(false);
      setError((profileRes.error ?? targetsRes.error)?.message ?? t('common.error'));
      return;
    }

    await refreshProfile();
    // guard in root layout swaps to (tabs) once onboardingComplete flips
    setBusy(false);
  };

  const genderOptions: { value: Gender; labelKey: string }[] = [
    { value: 'male', labelKey: 'onboarding.genderMale' },
    { value: 'female', labelKey: 'onboarding.genderFemale' },
    { value: 'other', labelKey: 'onboarding.genderOther' },
  ];

  return (
    <Screen>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'about' ? (
          <Animated.View entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)}>
            <AppText variant="h1">{t('onboarding.aboutTitle')}</AppText>
            <AppText variant="body" color="secondary" style={styles.subtitle}>
              {t('onboarding.aboutSubtitle')}
            </AppText>

            <View style={styles.form}>
              <Input
                label={t('onboarding.nameLabel')}
                placeholder={t('onboarding.namePlaceholder')}
                value={name}
                onChangeText={setName}
                error={nameError}
                autoComplete="name"
              />
              <Input
                label={t('onboarding.ageLabel')}
                value={age}
                onChangeText={setAge}
                error={ageError}
                keyboardType="number-pad"
                maxLength={3}
              />
              <View>
                <AppText variant="micro" color="secondary" style={styles.genderLabel}>
                  {t('onboarding.genderLabel')}
                </AppText>
                <View style={styles.genderRow}>
                  {genderOptions.map((option) => (
                    <Chip
                      key={option.value}
                      label={t(option.labelKey)}
                      selected={gender === option.value}
                      onPress={() => setGender(option.value)}
                    />
                  ))}
                </View>
              </View>
              <Input
                label={t('onboarding.countryLabel')}
                placeholder={t('onboarding.countryPlaceholder')}
                value={country}
                onChangeText={setCountry}
              />
              <Input
                label={t('onboarding.cityLabel')}
                placeholder={t('onboarding.cityPlaceholder')}
                value={city}
                onChangeText={setCity}
              />
              <Button label={t('common.continue')} onPress={goToCalibration} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInRight.duration(300)}>
            <AppText variant="h1">{t('onboarding.calibrationTitle')}</AppText>
            <AppText variant="body" color="secondary" style={styles.subtitle}>
              {t('onboarding.calibrationSubtitle')}
            </AppText>

            <View style={styles.form}>
              <Card style={styles.calibrationCard}>
                <AppText variant="h3">{t('onboarding.pushupsQuestion')}</AppText>
                <Stepper value={pushups} onChange={setPushups} min={0} max={200} bigStep={5} />
              </Card>
              <Card style={styles.calibrationCard}>
                <AppText variant="h3">{t('onboarding.squatsQuestion')}</AppText>
                <Stepper value={squats} onChange={setSquats} min={0} max={200} bigStep={5} />
              </Card>

              <AppText variant="caption" color="secondary" style={styles.targetsPreview}>
                {t('onboarding.startTargets', {
                  pushups: startTarget(pushups),
                  squats: startTarget(squats),
                })}
              </AppText>

              {error ? (
                <AppText variant="caption" color="error" accessibilityRole="alert">
                  {error}
                </AppText>
              ) : null}

              <Button label={t('onboarding.finish')} onPress={finish} loading={busy} />
              <Button label={t('common.back')} onPress={() => setStep('about')} variant="ghost" />
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  form: {
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
  genderLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  calibrationCard: {
    gap: spacing.lg,
  },
  targetsPreview: {
    textAlign: 'center',
  },
});
