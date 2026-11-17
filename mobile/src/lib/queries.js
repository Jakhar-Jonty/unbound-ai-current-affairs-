import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';
import { cacheArticle, canUseOffline, getCachedArticle, getBookmarksSnapshot, saveBookmarksSnapshot, syncPinned } from './offline';

const isOffline = (err) => err?.status === 0;


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

/** Article detail. Every opened article is kept for offline reading; offline, the saved copy is shown. */
export const useArticle = (id) => useQuery({
  queryKey: ['article', id],
  enabled: !!id,
  queryFn: async ({ signal }) => {
    try {
      const { article } = await api(`/articles/${id}`, { signal });
      if (canUseOffline()) cacheArticle(article);
      return article;
    } catch (err) {
      if (!isOffline(err)) throw err;
      const cached = await getCachedArticle(id);
      if (!cached) throw new Error('You’re offline and this article hasn’t been saved for offline reading.');
      return { ...cached, offline: true };
    }
  },
});
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
  return useQuery({ queryKey: ['me', user?.id, ...key], queryFn: ({ signal }) => api(path, { signal }), enabled: !!user?.id, ...options });
}

export const useAttempt = (id) => useMeQuery(['attempt', id], `/attempts/${id}`, { enabled: !!id });
export const useMyAttempts = () => useMeQuery(['attempts'], '/me/attempts?limit=50');
export const useProgress = () => useMeQuery(['progress'], '/me/progress');
/**
 * Saved items. When online, the list is snapshotted and every saved article is
 * downloaded for offline reading; when offline, the snapshot is shown.
 */
export function useBookmarks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['me', user?.id, 'bookmarks'],
    enabled: !!user?.id,
    queryFn: async ({ signal }) => {
      try {
        const data = await api('/me/bookmarks?limit=50', { signal });
        await saveBookmarksSnapshot(user.id, data);
        const savedArticleIds = data.items.filter((b) => b.itemType === 'article' && b.item).map((b) => String(b.item.id));
        const missing = canUseOffline() ? await syncPinned(savedArticleIds) : [];
        // Download saved articles in the background (premium).
        Promise.all(missing.map((aid) => api(`/articles/${aid}`).then((r) => cacheArticle(r.article, { pinned: true })).catch(() => {})));
        return data;
      } catch (err) {
        if (!isOffline(err)) throw err;
        const snap = await getBookmarksSnapshot(user.id);
        if (!snap) throw err;
        return { ...snap, offline: true };
      }
    },
  });
}

export const useLeaderboard = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: ['leaderboard', user?.id], queryFn: ({ signal }) => api('/leaderboard/weekly', { signal }), staleTime: 30 * 1000 });
};

export const usePracticeSubjects = () => useMeQuery(['practice-subjects'], '/practice/subjects', { staleTime: 5 * 60 * 1000 });

export function usePracticeSet(subject) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['me', user?.id, 'practice', subject],
    queryFn: ({ signal }) => api(`/practice/questions?subject=${subject}&count=10`, { signal }),
    enabled: !!user && !!subject,
    staleTime: Infinity,
    gcTime: 0,
  });
}

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
      if (itemType === 'article' && bookmarkId && canUseOffline()) {
        const article = qc.getQueryData(['article', itemId]);
        if (article) cacheArticle(article, { pinned: true });
      }
      qc.invalidateQueries({ queryKey: ['me', user?.id, 'bookmarks'] });
    },
  });
  return { bookmarked: !!status.data, toggle: () => toggle.mutate(), busy: toggle.isPending, error: toggle.error };
}

export const useBillingPlans = () => useQuery({ queryKey: ['billing-plans'], queryFn: () => api('/billing/plans'), staleTime: 10 * 60 * 1000 });
export const useBillingStatus = () => useMeQuery(['billing-status'], '/billing/status');
export const useInsights = () => useMeQuery(['insights'], '/me/insights', { retry: (n, err) => err?.status !== 403 && n < 2 });
