import type { Repositories } from "../db/repositories";

export interface CachedValue<T> {
  value: T;
  fetchedAt: string;
  stale: boolean;
}

export interface Cache {
  getOrFetch<T>(key: string, ttlMs: number, fetch: () => Promise<T>): Promise<CachedValue<T>>;
}

// Serves fresh entries from the cache, refetches expired ones, and falls back to an expired entry
// (marked stale) when the refetch fails. With no entry to fall back to, the error is rethrown.
export function createCache(repo: Repositories["cache"]): Cache {
  return {
    async getOrFetch<T>(key: string, ttlMs: number, fetch: () => Promise<T>): Promise<CachedValue<T>> {
      const now = new Date();
      const entry = repo.get(key);
      if (entry && now.getTime() < Date.parse(entry.expiresAt)) {
        return { value: JSON.parse(entry.payload) as T, fetchedAt: entry.fetchedAt, stale: false };
      }
      try {
        const value = await fetch();
        const fetchedAt = now.toISOString();
        repo.set(key, JSON.stringify(value), fetchedAt, new Date(now.getTime() + ttlMs).toISOString());
        return { value, fetchedAt, stale: false };
      } catch (error) {
        if (entry) return { value: JSON.parse(entry.payload) as T, fetchedAt: entry.fetchedAt, stale: true };
        throw error;
      }
    },
  };
}
