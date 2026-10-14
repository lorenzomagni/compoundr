import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { queryKeys } from "./hooks";

export interface WatchlistItem {
  ticker: string;
  addedAt: string;
  tags: string[];
  notes: string;
  reviewAt: string | null;
  currentScore: { pass: number; evaluated: number } | null;
  lastSnapshot: { createdAt: string; pass: number; evaluated: number } | null;
}

// Every write is optimistic: the list changes at once, and is rolled back if the server refuses.
export function useWatchlist() {
  return useQuery({ queryKey: queryKeys.watchlist, queryFn: () => api.get<WatchlistItem[]>("/watchlist") });
}

export function useAddWatchlist() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ticker: string) => api.post<{ ticker: string }>("/watchlist", { ticker }),
    onMutate: async (ticker) => {
      await client.cancelQueries({ queryKey: queryKeys.watchlist });
      const previous = client.getQueryData<WatchlistItem[]>(queryKeys.watchlist) ?? [];
      client.setQueryData<WatchlistItem[]>(queryKeys.watchlist, [
        ...previous,
        { ticker, addedAt: new Date().toISOString(), tags: [], notes: "", reviewAt: null, currentScore: null, lastSnapshot: null },
      ]);
      return { previous };
    },
    onError: (_error, _ticker, context) => {
      client.setQueryData(queryKeys.watchlist, context?.previous ?? []);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.watchlist }),
  });
}

export function useUpdateNotes() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ticker, notes }: { ticker: string; notes: string }) =>
      api.patch(`/watchlist/${encodeURIComponent(ticker)}`, { notes }),
    onMutate: async ({ ticker, notes }) => {
      await client.cancelQueries({ queryKey: queryKeys.watchlist });
      const previous = client.getQueryData<WatchlistItem[]>(queryKeys.watchlist) ?? [];
      client.setQueryData<WatchlistItem[]>(
        queryKeys.watchlist,
        previous.map((w) => (w.ticker === ticker ? { ...w, notes } : w)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      client.setQueryData(queryKeys.watchlist, context?.previous ?? []);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.watchlist }),
  });
}

export function useRemoveWatchlist() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ticker: string) => api.del(`/watchlist/${encodeURIComponent(ticker)}`),
    onMutate: async (ticker) => {
      await client.cancelQueries({ queryKey: queryKeys.watchlist });
      const previous = client.getQueryData<WatchlistItem[]>(queryKeys.watchlist) ?? [];
      client.setQueryData<WatchlistItem[]>(
        queryKeys.watchlist,
        previous.filter((w) => w.ticker !== ticker),
      );
      return { previous };
    },
    onError: (_error, _ticker, context) => {
      client.setQueryData(queryKeys.watchlist, context?.previous ?? []);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.watchlist }),
  });
}
