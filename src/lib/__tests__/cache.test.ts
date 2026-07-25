import AsyncStorage from '@react-native-async-storage/async-storage';

import { cachedFetch, invalidateCache } from '../cache';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- official AsyncStorage jest mock pattern
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('cachedFetch', () => {
  it('fetches and stores on a cold cache', async () => {
    const fetcher = jest.fn().mockResolvedValue([1, 2, 3]);
    await expect(cachedFetch('k', 60_000, fetcher)).resolves.toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('serves from cache while fresh — fetcher not called again', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');
    await cachedFetch('k', 60_000, fetcher);
    await expect(cachedFetch('k', 60_000, fetcher)).resolves.toBe('data');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches once the TTL expires', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    await cachedFetch('k', 60_000, fetcher);
    now.mockReturnValue(1_000 + 61_000);
    await expect(cachedFetch('k', 60_000, fetcher)).resolves.toBe('new');
    expect(fetcher).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it('falls back to stale data when the refetch fails (offline)', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce('stale')
      .mockRejectedValueOnce(new Error('offline'));
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    await cachedFetch('k', 60_000, fetcher);
    now.mockReturnValue(1_000 + 61_000);
    await expect(cachedFetch('k', 60_000, fetcher)).resolves.toBe('stale');
    now.mockRestore();
  });

  it('rethrows when there is no cache to fall back to', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(cachedFetch('k', 60_000, fetcher)).rejects.toThrow('offline');
  });

  it('invalidateCache forces the next call to fetch', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
    await cachedFetch('k', 60_000, fetcher);
    await invalidateCache('k');
    await expect(cachedFetch('k', 60_000, fetcher)).resolves.toBe('b');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
