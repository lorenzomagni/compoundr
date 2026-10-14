import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../../../src/server/db/schema";
import { createRepositories, type Repositories } from "../../../src/server/db/repositories";
import { createCache } from "../../../src/server/providers/cache";

let repos: Repositories;
beforeEach(() => {
  repos = createRepositories(openDb(":memory:"));
});

describe("ttl cache", () => {
  it("serves a fresh entry without calling fetch", async () => {
    const cache = createCache(repos.cache);
    await cache.getOrFetch("k", 60_000, async () => ({ n: 1 }));
    let calls = 0;
    const r = await cache.getOrFetch("k", 60_000, async () => {
      calls++;
      return { n: 2 };
    });
    expect(calls).toBe(0);
    expect(r.value).toEqual({ n: 1 });
    expect(r.stale).toBe(false);
  });

  it("returns an expired entry marked stale when the refetch fails", async () => {
    const cache = createCache(repos.cache);
    // ttl 0 makes the entry expired immediately.
    await cache.getOrFetch("k", 0, async () => ({ n: 1 }));
    const r = await cache.getOrFetch("k", 0, async () => {
      throw new Error("quota");
    });
    expect(r.value).toEqual({ n: 1 });
    expect(r.stale).toBe(true);
  });

  it("rethrows when there is no cached entry to fall back to", async () => {
    const cache = createCache(repos.cache);
    await expect(
      cache.getOrFetch("missing", 60_000, async () => {
        throw new Error("down");
      }),
    ).rejects.toThrow("down");
  });
});
