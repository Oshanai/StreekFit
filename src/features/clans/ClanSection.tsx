/**
 * Clan tab content for the Rating screen (TZ §16): intro + create/search
 * when clanless, clan overview (totals, cheers, member contributions) when
 * in a clan. Rendered inside the Rating tab's ScrollView.
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  ScalePressable,
  spacing,
  useTheme,
} from '@/shared/ui';

import {
  CHEER_PHRASES,
  CLAN_EMBLEMS,
  createClan,
  fetchCheers,
  fetchClanMembers,
  fetchClanTotals,
  fetchMyClan,
  joinClan,
  leaveClan,
  searchClans,
  sendCheer,
  type CheerPhrase,
  type CheerRow,
  type ClanEmblemCode,
  type ClanMemberRow,
  type ClanSummary,
  type ClanTotals,
  type MyClan,
} from './api';
import { ClanEmblem } from './ClanEmblem';

export function ClanSection() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const [phase, setPhase] = useState<'loading' | 'none' | 'member'>('loading');
  const [myClan, setMyClan] = useState<MyClan | null>(null);
  const [totals, setTotals] = useState<ClanTotals | null>(null);
  const [members, setMembers] = useState<ClanMemberRow[]>([]);
  const [cheers, setCheers] = useState<CheerRow[]>([]);

  const [rating, setRating] = useState<ClanSummary[]>([]);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmblem, setNewEmblem] = useState<ClanEmblemCode>('flame');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(() => {
    let alive = true;
    void (async () => {
      const mine = await fetchMyClan();
      if (!alive) return;
      setMyClan(mine);
      if (mine == null) {
        setPhase('none');
        const top = await searchClans('');
        if (alive) setRating(top);
      } else {
        setPhase('member');
        const [tot, mem, ch] = await Promise.all([
          fetchClanTotals(mine.id),
          fetchClanMembers(mine.id),
          fetchCheers(mine.id),
        ]);
        if (!alive) return;
        setTotals(tot);
        setMembers(mem);
        setCheers(ch);
      }
    })().catch(() => {
      if (alive) setPhase((p) => (p === 'loading' ? 'none' : p));
    });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(load);

  const runSearch = () => {
    setErrorKey(null);
    void searchClans(query.trim())
      .then(setRating)
      .catch(() => setRating([]));
  };

  const onCreate = () => {
    if (busy || newName.trim().length < 3) return;
    setBusy(true);
    setErrorKey(null);
    void createClan(newName.trim(), newEmblem)
      .then(() => {
        setNewName('');
        load();
      })
      .catch(() => setErrorKey('clan.createError'))
      .finally(() => setBusy(false));
  };

  const onJoin = (clanId: string) => {
    if (busy) return;
    setBusy(true);
    setErrorKey(null);
    void joinClan({ clanId })
      .then(() => load())
      .catch(() => setErrorKey('clan.joinError'))
      .finally(() => setBusy(false));
  };

  const onLeave = () => {
    if (busy) return;
    setBusy(true);
    void leaveClan()
      .then(() => {
        setMyClan(null);
        load();
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  const onCheer = (phrase: CheerPhrase) => {
    if (myClan == null) return;
    void sendCheer(myClan.id, phrase)
      .then(() => fetchCheers(myClan.id).then(setCheers))
      .catch(() => {});
  };

  if (phase === 'loading') {
    return (
      <Card style={styles.noticeCard}>
        <ActivityIndicator color={colors.primary} />
      </Card>
    );
  }

  if (phase === 'none' || myClan == null) {
    return (
      <View style={styles.stack}>
        <Card style={styles.introCard}>
          <AppText variant="h3">{t('clan.introTitle')}</AppText>
          <AppText variant="caption" color="secondary">
            {t('clan.introBody')}
          </AppText>
        </Card>

        <Card style={styles.formCard}>
          <AppText variant="h3">{t('clan.createTitle')}</AppText>
          <Input
            label={t('clan.nameLabel')}
            value={newName}
            onChangeText={setNewName}
            placeholder={t('clan.namePlaceholder')}
            maxLength={24}
          />
          <View style={styles.emblemRow}>
            {CLAN_EMBLEMS.map((code) => (
              <ScalePressable
                key={code}
                onPress={() => setNewEmblem(code)}
                accessibilityRole="button"
                accessibilityLabel={code}
              >
                <View
                  style={[
                    styles.emblemCell,
                    newEmblem === code && { borderColor: colors.primary },
                  ]}
                >
                  <ClanEmblem code={code} size={40} />
                </View>
              </ScalePressable>
            ))}
          </View>
          <Button
            label={t('clan.create')}
            onPress={onCreate}
            disabled={newName.trim().length < 3}
            loading={busy}
          />
        </Card>

        <Card style={styles.formCard}>
          <AppText variant="h3">{t('clan.findTitle')}</AppText>
          <Input
            label={t('clan.searchLabel')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('clan.searchPlaceholder')}
            autoCorrect={false}
          />
          <Button label={t('lb.find')} variant="secondary" onPress={runSearch} />

          {rating.map((clan) => (
            <View key={clan.clan_id} style={styles.clanRow}>
              <ClanEmblem code={clan.emblem} size={40} />
              <View style={styles.clanRowText}>
                <AppText variant="bodyBold" numberOfLines={1}>
                  {clan.name}
                </AppText>
                <AppText variant="micro" color="secondary" tabular>
                  {t('clan.rowMeta', { members: clan.member_count, points: clan.points_14d })}
                </AppText>
              </View>
              <Button label={t('clan.join')} onPress={() => onJoin(clan.clan_id)} disabled={busy} />
            </View>
          ))}
        </Card>

        {errorKey ? (
          <AppText variant="caption" color="secondary" style={styles.centered}>
            {t(errorKey)}
          </AppText>
        ) : null}
      </View>
    );
  }

  const memberNames = new Map(members.map((m) => [m.user_id, m.name]));
  const avgDay = totals != null ? Math.round(totals.last_14d / 14) : 0;

  return (
    <View style={styles.stack}>
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <ClanEmblem code={myClan.emblem} size={56} />
          <View style={styles.clanRowText}>
            <AppText variant="h2" numberOfLines={1}>
              {myClan.name}
            </AppText>
            <AppText variant="caption" color="secondary" selectable tabular>
              {t('clan.codeLine', { code: myClan.joinCode })}
            </AppText>
          </View>
        </View>

        <View style={styles.totalsRow}>
          <View style={styles.totalCell}>
            <AppText variant="h2" color="accent" tabular>
              {(totals?.all_time ?? 0).toLocaleString(i18n.language)}
            </AppText>
            <AppText variant="micro" color="secondary">
              {t('clan.allTime')}
            </AppText>
          </View>
          <View style={styles.totalCell}>
            <AppText variant="h2" tabular>
              {(totals?.last_14d ?? 0).toLocaleString(i18n.language)}
            </AppText>
            <AppText variant="micro" color="secondary">
              {t('clan.last14')}
            </AppText>
          </View>
          <View style={styles.totalCell}>
            <AppText variant="h2" color="info" tabular>
              {avgDay.toLocaleString(i18n.language)}
            </AppText>
            <AppText variant="micro" color="secondary">
              {t('clan.avgDay')}
            </AppText>
          </View>
        </View>
      </Card>

      <Card style={styles.formCard}>
        <AppText variant="h3">{t('clan.cheersTitle')}</AppText>
        <View style={styles.cheerChips}>
          {CHEER_PHRASES.map((phrase) => (
            <Chip
              key={phrase}
              label={t(`clan.cheer_${phrase}`)}
              selected={false}
              accessibilityRole="button"
              onPress={() => onCheer(phrase)}
            />
          ))}
        </View>
        {cheers.map((cheer) => (
          <View key={cheer.id} style={styles.cheerRow}>
            <AppText variant="caption" style={styles.cheerText} numberOfLines={1}>
              <AppText variant="caption" color="accent">
                {memberNames.get(cheer.user_id) ?? '—'}
              </AppText>
              {'  '}
              {t(`clan.cheer_${cheer.phrase}`)}
            </AppText>
            <AppText variant="micro" color="secondary" tabular>
              {new Date(cheer.created_at).toLocaleTimeString(i18n.language, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </AppText>
          </View>
        ))}
      </Card>

      <Card style={styles.formCard}>
        <AppText variant="h3">{t('clan.membersTitle', { count: members.length })}</AppText>
        {members.map((member, index) => (
          <View key={member.user_id} style={styles.memberRow}>
            <AppText variant="bodyBold" tabular style={styles.rank}>
              {index + 1}
            </AppText>
            <Avatar name={member.name} imageUrl={member.avatar_url} size={36} />
            <View style={styles.clanRowText}>
              <AppText variant="body" numberOfLines={1}>
                {member.name ?? '—'}
                {member.role === 'owner' ? ` · ${t('clan.owner')}` : ''}
              </AppText>
              <AppText variant="micro" color="secondary" tabular>
                {t('clan.memberMeta', { streak: member.streak })}
              </AppText>
            </View>
            <AppText variant="bodyBold" color="accent" tabular>
              {member.contribution_14d}
            </AppText>
          </View>
        ))}
      </Card>

      <Button label={t('clan.leave')} variant="ghost" onPress={onLeave} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  noticeCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  introCard: {
    gap: spacing.sm,
  },
  formCard: {
    gap: spacing.sm,
  },
  emblemRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emblemCell: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 24,
    padding: 2,
  },
  clanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clanRowText: {
    flex: 1,
    gap: 2,
  },
  centered: {
    textAlign: 'center',
  },
  headerCard: {
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  totalsRow: {
    flexDirection: 'row',
  },
  totalCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  cheerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cheerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cheerText: {
    flex: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rank: {
    width: 24,
    textAlign: 'center',
  },
});
