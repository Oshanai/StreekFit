/**
 * Tiny stale-while-revalidate cache over AsyncStorage (TZ §11.4: кеширование
 * лидербордов и профиля). Returns cached data instantly when fresh enough,
 * refreshes in the background; falls back to stale data when offline.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEntry<T> = { at: number; data: T };

const PREFIX = 'streekfit.cache.';

export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  onRefresh?: (fresh: T) => void,
): Promise<T> {
  const storageKey = PREFIX + key;

  let cached: CacheEntry<T> | null = null;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw != null) cached = JSON.parse(raw) as CacheEntry<T>;
  } catch {
    cached = null;
  }

  const fresh = cached != null && Date.now() - cached.at < ttlMs;

  if (cached != null && fresh) {
    return cached.data;
  }

  try {
    const data = await fetcher();
    void AsyncStorage.setItem(storageKey, JSON.stringify({ at: Date.now(), data }));
    onRefresh?.(data);
    return data;
  } catch (error) {
    // Offline / server hiccup — stale beats empty.
    if (cached != null) return cached.data;
    throw error;
  }
}

export async function invalidateCache(key: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + key);
}
