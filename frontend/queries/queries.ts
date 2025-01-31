import api from "@/lib/api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export function useMeQuery() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(),
  });
}

export function useThreadsQuery(search?: string) {
  return useInfiniteQuery({
    queryKey: ["threads", search],
    queryFn: async ({ pageParam = 1 }) => {
      const threads = await api.getThreads(pageParam, search);
      return {
        threads,
        nextPage: threads.length === 10 ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });
}

export function useThreadQuery(threadId: string, isNewThread: boolean) {
  return useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => api.getThread(threadId),
    enabled: !isNewThread, // Only fetch if it's not a new thread
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useModelsQuery() {
  return useQuery({
    queryKey: ["models"],
    queryFn: () => api.getAvailableModels(),
  });
}
