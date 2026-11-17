import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

const PAGE = 20;

function nextPage(last) {
  return last.page * last.limit < last.total ? last.page + 1 : undefined;
}

export function useArticles({ subject, q } = {}) {
  return useInfiniteQuery({
    queryKey: ['articles', { subject, q }],
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ page: String(pageParam), limit: String(PAGE) });
      if (subject) params.set('subject', subject);
      if (q) params.set('q', q);
      return api(`/articles?${params}`, { signal });
    },
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

export const useArticle = (id) => useQuery({ queryKey: ['article', id], queryFn: ({ signal }) => api(`/articles/${id}`, { signal }).then((r) => r.article), enabled: !!id });
export const useTaxonomy = () => useQuery({ queryKey: ['taxonomy'], queryFn: () => api('/taxonomy'), staleTime: 24 * 3600 * 1000 });
export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => api('/meta'), staleTime: 3600 * 1000, retry: 1 });

export function useTodayQuiz() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['quiz', 'today', user?.id],
    queryFn: ({ signal }) => api('/quizzes/today', { signal }),
    retry: (count, err) => err.status !== 404 && count < 2,
  });
}

export function useQuiz(id) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['quiz', id, user?.id], queryFn: ({ signal }) => api(`/quizzes/${id}`, { signal }), enabled: !!id });
}

export const useQuizzes = () => useInfiniteQuery({
  queryKey: ['quizzes'],
  queryFn: ({ pageParam, signal }) => api(`/quizzes?type=daily&page=${pageParam}&limit=${PAGE}`, { signal }),
  initialPageParam: 1,
  getNextPageParam: nextPage,
});

function useMeQuery(key, path, options = {}) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['me', user?.id, ...key], queryFn: ({ signal }) => api(path, { signal }), enabled: !!user && !user.offline, ...options });
}

export const useAttempt = (id) => useMeQuery(['attempt', id], `/attempts/${id}`, { enabled: !!id });
export const useMyAttempts = () => useMeQuery(['attempts'], '/me/attempts?limit=50');
export const useProgress = () => useMeQuery(['progress'], '/me/progress');
export const useBookmarks = () => useMeQuery(['bookmarks'], '/me/bookmarks?limit=50');

export function useSubmitAttempt(quizId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api(`/quizzes/${quizId}/attempts`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quiz'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

/** Bookmark state for one item plus a toggle. */
export function useBookmarkToggle(itemType, itemId) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const status = useQuery({
    queryKey: ['me', user?.id, 'bookmark-status', itemType, itemId],
    queryFn: () => api(`/me/bookmarks/status?itemType=${itemType}&ids=${itemId}`).then((r) => r.bookmarks[itemId] || null),
    enabled: !!user && !user.offline && !!itemId,
  });
  const toggle = useMutation({
    mutationFn: async () => {
      if (status.data) {
        await api(`/me/bookmarks/${status.data}`, { method: 'DELETE' });
        return null;
      }
      const r = await api('/me/bookmarks', { method: 'POST', body: { itemType, itemId } });
      return r.bookmark.id;
    },
    onSuccess: (bookmarkId) => {
      qc.setQueryData(['me', user?.id, 'bookmark-status', itemType, itemId], bookmarkId);
      qc.invalidateQueries({ queryKey: ['me', user?.id, 'bookmarks'] });
    },
  });
  return { bookmarked: !!status.data, toggle: () => toggle.mutate(), busy: toggle.isPending, error: toggle.error };
}
