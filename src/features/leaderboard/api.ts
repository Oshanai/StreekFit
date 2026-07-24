/**
 * Leaderboards + friendships (TZ §7). City boards come from precomputed
 * snapshots (the RPC refreshes at most every 15 min); the friends board is
 * live — the member set is tiny. Friend identity = first 8 chars of the
 * profile uuid («код друга»).
 */

import { supabase } from '@/lib/supabase/client';

export type BoardRow = {
  rank: number;
  points: number;
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  frame_id: string | null;
  is_me: boolean;
};

export async function fetchCityBoard(city: string): Promise<BoardRow[]> {
  const { data, error } = await supabase.rpc('city_leaderboard', { target_city: city });
  if (error) throw error;
  return (data ?? []) as BoardRow[];
}

export async function fetchFriendsBoard(): Promise<BoardRow[]> {
  const { data, error } = await supabase.rpc('friends_leaderboard');
  if (error) throw error;
  return (data ?? []) as BoardRow[];
}

export type FoundProfile = {
  user_id: string;
  name: string | null;
  city: string | null;
  avatar_url: string | null;
};

export async function findProfileByCode(code: string): Promise<FoundProfile[]> {
  const { data, error } = await supabase.rpc('find_profile_by_code', { code });
  if (error) throw error;
  return (data ?? []) as FoundProfile[];
}

export function friendCodeOf(userId: string): string {
  return userId.slice(0, 8);
}

export async function sendFriendRequest(friendId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  const me = auth.session?.user.id;
  if (!me) throw new Error('not signed in');
  const { error } = await supabase
    .from('friendships')
    .insert({ user_id: me, friend_id: friendId, status: 'pending' });
  if (error) throw error;
}

export async function acceptFriendRequest(requesterId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  const me = auth.session?.user.id;
  if (!me) throw new Error('not signed in');
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('user_id', requesterId)
    .eq('friend_id', me);
  if (error) throw error;
}

export type IncomingRequest = { user_id: string; name: string | null };

/** Pending requests addressed to me, with requester names resolved. */
export async function fetchIncomingRequests(): Promise<IncomingRequest[]> {
  const { data: auth } = await supabase.auth.getSession();
  const me = auth.session?.user.id;
  if (!me) return [];

  const { data: rows } = await supabase
    .from('friendships')
    .select('user_id')
    .eq('friend_id', me)
    .eq('status', 'pending');
  const ids = (rows ?? []).map((r) => r.user_id as string);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, p.name as string | null]));
  return ids.map((id) => ({ user_id: id, name: names.get(id) ?? null }));
}
