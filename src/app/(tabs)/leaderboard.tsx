import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  acceptFriendRequest,
  fetchCityBoard,
  fetchFriendsBoard,
  fetchIncomingRequests,
  findProfileByCode,
  friendCodeOf,
  sendFriendRequest,
  type BoardRow,
  type FoundProfile,
  type IncomingRequest,
} from '@/features/leaderboard/api';
import { usePremium } from '@/features/leaderboard/usePremium';
import {
  AppText,
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Screen,
  spacing,
  useTheme,
} from '@/shared/ui';

type BoardScope = 'city' | 'friends';

/** Rating tab: city/friends leaderboards (paid) + the free friends graph. */
export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session, profile } = useAuth();
  const { premium } = usePremium();

  const [scope, setScope] = useState<BoardScope>('city');
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [code, setCode] = useState('');
  const [found, setFound] = useState<FoundProfile[]>([]);
  const [requestState, setRequestState] = useState<'idle' | 'sent' | 'error'>('idle');

  const city = profile?.city ?? '';
  const myCode = session ? friendCodeOf(session.user.id) : '';

  const loadBoard = useCallback(() => {
    if (!premium) return;
    setLoadingBoard(true);
    const load = scope === 'city' ? (city ? fetchCityBoard(city) : Promise.resolve([])) : fetchFriendsBoard();
    void load
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoadingBoard(false));
  }, [premium, scope, city]);

  const loadIncoming = useCallback(() => {
    void fetchIncomingRequests()
      .then(setIncoming)
      .catch(() => setIncoming([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBoard();
      loadIncoming();
    }, [loadBoard, loadIncoming]),
  );

  const search = () => {
    setRequestState('idle');
    void findProfileByCode(code.trim())
      .then(setFound)
      .catch(() => setFound([]));
  };

  const addFriend = (userId: string) => {
    void sendFriendRequest(userId)
      .then(() => {
        setRequestState('sent');
        setFound([]);
        setCode('');
      })
      .catch(() => setRequestState('error'));
  };

  const accept = (userId: string) => {
    void acceptFriendRequest(userId)
      .then(() => {
        loadIncoming();
        loadBoard();
      })
      .catch(() => {});
  };

  return (
    <Screen insideTabs>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <AppText variant="h1" style={styles.title}>
        {t('lb.title')}
      </AppText>

      {premium ? (
        <>
          <View style={styles.scopeRow}>
            <Chip label={t('lb.city')} selected={scope === 'city'} onPress={() => setScope('city')} />
            <Chip
              label={t('lb.friends')}
              selected={scope === 'friends'}
              onPress={() => setScope('friends')}
            />
          </View>

          {scope === 'city' && !city ? (
            <Card style={styles.noticeCard}>
              <AppText variant="body" color="secondary" style={styles.centered}>
                {t('lb.noCity')}
              </AppText>
            </Card>
          ) : rows.length === 0 && !loadingBoard ? (
            <Card style={styles.noticeCard}>
              <AppText variant="body" color="secondary" style={styles.centered}>
                {t('lb.empty')}
              </AppText>
            </Card>
          ) : (
            <Card style={styles.boardCard}>
              {rows.map((row) => (
                <View
                  key={row.user_id}
                  style={[
                    styles.boardRow,
                    row.is_me && { backgroundColor: colors.primarySoft, borderRadius: 12 },
                  ]}
                >
                  <AppText variant="bodyBold" tabular style={styles.rank}>
                    {row.rank}
                  </AppText>
                  <Avatar name={row.name} imageUrl={row.avatar_url} size={36} />
                  <AppText variant="body" style={styles.rowName} numberOfLines={1}>
                    {row.name ?? '—'}
                  </AppText>
                  <AppText variant="bodyBold" color="accent" tabular>
                    {t('lb.points', { count: row.points })}
                  </AppText>
                </View>
              ))}
            </Card>
          )}
        </>
      ) : (
        <Card style={styles.lockCard}>
          <AppText variant="h2" style={styles.centered}>
            {t('lb.locked')}
          </AppText>
          <AppText variant="body" color="secondary" style={styles.centered}>
            {t('lb.lockedBody')}
          </AppText>
        </Card>
      )}

      {/* Friends graph — free: it feeds the viral loop (TZ §9). */}
      <Card style={styles.friendsCard}>
        <AppText variant="h3">{t('lb.addFriend')}</AppText>
        <View style={styles.codeRow}>
          <AppText variant="caption" color="secondary">
            {t('lb.yourCode')}
          </AppText>
          <AppText variant="bodyBold" color="accent" tabular selectable>
            {myCode}
          </AppText>
        </View>
        <Input
          label={t('lb.codeLabel')}
          value={code}
          onChangeText={setCode}
          placeholder={t('lb.codePlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button label={t('lb.find')} variant="secondary" onPress={search} disabled={code.trim().length < 6} />

        {found.map((p) => (
          <View key={p.user_id} style={styles.foundRow}>
            <Avatar name={p.name} imageUrl={p.avatar_url} size={36} />
            <View style={styles.rowName}>
              <AppText variant="body" numberOfLines={1}>
                {p.name ?? '—'}
              </AppText>
              {p.city ? (
                <AppText variant="caption" color="secondary">
                  {p.city}
                </AppText>
              ) : null}
            </View>
            <Button label={t('lb.add')} onPress={() => addFriend(p.user_id)} />
          </View>
        ))}
        {requestState === 'sent' ? (
          <AppText variant="caption" color="accent">
            {t('lb.requestSent')}
          </AppText>
        ) : null}
        {requestState === 'error' ? (
          <AppText variant="caption" color="secondary">
            {t('lb.requestError')}
          </AppText>
        ) : null}
      </Card>

      {incoming.length > 0 ? (
        <Card style={styles.friendsCard}>
          <AppText variant="h3">{t('lb.incoming')}</AppText>
          {incoming.map((r) => (
            <View key={r.user_id} style={styles.foundRow}>
              <Avatar name={r.name} size={36} />
              <AppText variant="body" style={styles.rowName} numberOfLines={1}>
                {r.name ?? '—'}
              </AppText>
              <Button label={t('lb.accept')} onPress={() => accept(r.user_id)} />
            </View>
          ))}
        </Card>
      ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxl,
  },
  title: {
    marginBottom: spacing.xl,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  noticeCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  boardCard: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rank: {
    width: 28,
    textAlign: 'center',
  },
  rowName: {
    flex: 1,
  },
  lockCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  friendsCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  centered: {
    textAlign: 'center',
  },
});
