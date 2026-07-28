/**
 * Clans data access (TZ §16): membership, search/rating, totals, members,
 * cheers. All writes go through security-definer RPCs; cheers are preset
 * phrase codes only — the client never sends free text.
 */

import { supabase } from '@/lib/supabase/client';

export type ClanEmblemCode = 'flame' | 'bolt' | 'mountain' | 'wolf' | 'star' | 'crown';
export const CLAN_EMBLEMS: ClanEmblemCode[] = [
  'flame',
  'bolt',
  'mountain',
  'wolf',
  'star',
  'crown',
];

export type MyClan = {
  id: string;
  name: string;
  emblem: ClanEmblemCode;
  joinCode: string;
  role: 'owner' | 'member';
};

export type ClanSummary = {
  clan_id: string;
  name: string;
  emblem: ClanEmblemCode;
  member_count: number;
  points_14d: number;
};

export type ClanTotals = {
  all_time: number;
  last_14d: number;
  member_count: number;
};

export type ClanMemberRow = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  role: 'owner' | 'member';
  contribution_14d: number;
  streak: number;
};

export const CHEER_PHRASES = ['go', 'fire', 'strong', 'beat', 'welcome', 'proud'] as const;
export type CheerPhrase = (typeof CHEER_PHRASES)[number];

export type CheerRow = {
  id: string;
  user_id: string;
  phrase: CheerPhrase;
  created_at: string;
};

export async function fetchMyClan(): Promise<MyClan | null> {
  const { data: auth } = await supabase.auth.getSession();
  const me = auth.session?.user.id;
  if (!me) return null;

  const { data } = await supabase
    .from('clan_members')
    .select('role, clans (id, name, emblem, join_code)')
    .eq('user_id', me)
    .maybeSingle();
  const clan = (data?.clans ?? null) as {
    id: string;
    name: string;
    emblem: string;
    join_code: string;
  } | null;
  if (clan == null) return null;
  return {
    id: clan.id,
    name: clan.name,
    emblem: clan.emblem as ClanEmblemCode,
    joinCode: clan.join_code,
    role: (data?.role as 'owner' | 'member') ?? 'member',
  };
}

export async function createClan(name: string, emblem: ClanEmblemCode): Promise<string> {
  const { data, error } = await supabase.rpc('create_clan', {
    clan_name: name,
    clan_emblem: emblem,
  });
  if (error) throw error;
  return data as string;
}

export async function joinClan(opts: { clanId?: string; code?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('join_clan', {
    target_clan: opts.clanId ?? null,
    code: opts.code ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function leaveClan(): Promise<void> {
  const { error } = await supabase.rpc('leave_clan');
  if (error) throw error;
}

/** Empty query = the clan rating (top by 14-day points). */
export async function searchClans(query = ''): Promise<ClanSummary[]> {
  const { data, error } = await supabase.rpc('clan_search', { query });
  if (error) throw error;
  return (data ?? []) as ClanSummary[];
}

export async function fetchClanTotals(clanId: string): Promise<ClanTotals> {
  const { data, error } = await supabase.rpc('clan_totals', { target_clan: clanId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as ClanTotals | undefined;
  return row ?? { all_time: 0, last_14d: 0, member_count: 0 };
}

export async function fetchClanMembers(clanId: string): Promise<ClanMemberRow[]> {
  const { data, error } = await supabase.rpc('clan_members_board', { target_clan: clanId });
  if (error) throw error;
  return (data ?? []) as ClanMemberRow[];
}

export async function fetchCheers(clanId: string, limit = 12): Promise<CheerRow[]> {
  const { data } = await supabase
    .from('clan_cheers')
    .select('id, user_id, phrase, created_at')
    .eq('clan_id', clanId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as CheerRow[];
}

export async function sendCheer(clanId: string, phrase: CheerPhrase): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  const me = auth.session?.user.id;
  if (!me) throw new Error('not signed in');
  const { error } = await supabase
    .from('clan_cheers')
    .insert({ clan_id: clanId, user_id: me, phrase });
  if (error) throw error;
}
