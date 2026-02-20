import { CACHE_KEY_PREFIX, CACHE_TTL_MS } from './constants';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/** Get cached data, returns null if expired or missing */
export async function getCache<T>(key: string): Promise<T | null> {
  const storageKey = CACHE_KEY_PREFIX + key;
  const result = await chrome.storage.local.get(storageKey);
  const entry = result[storageKey] as CacheEntry<T> | undefined;

  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    await chrome.storage.local.remove(storageKey);
    return null;
  }
  return entry.data;
}

/** Store data in cache with current timestamp */
export async function setCache<T>(key: string, data: T): Promise<void> {
  const storageKey = CACHE_KEY_PREFIX + key;
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  await chrome.storage.local.set({ [storageKey]: entry });
}

/** Clear cache for a specific key */
export async function clearCache(key: string): Promise<void> {
  const storageKey = CACHE_KEY_PREFIX + key;
  await chrome.storage.local.remove(storageKey);
}

/** Clear all tag caches */
export async function clearAllCaches(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(all).filter((k) => k.startsWith(CACHE_KEY_PREFIX));
  if (cacheKeys.length > 0) {
    await chrome.storage.local.remove(cacheKeys);
  }
}
