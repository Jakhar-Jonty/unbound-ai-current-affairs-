import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing } from '../theme';
import { ListSkeleton } from './Skeleton';

/** Infinite, pull-to-refresh list that fills a tab screen. */
export default function ListScreen({ query, renderItem, header, empty, keyExtractor = (i) => String(i.id) }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const items = query?.data?.pages?.flatMap((p) => p.items) ?? [];
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
      data={items}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={query?.isLoading ? <ListSkeleton /> : empty}
      ListFooterComponent={query?.isFetchingNextPage ? <View style={{ padding: spacing.lg }}><ActivityIndicator color={c.accent} /></View> : null}
      onEndReachedThreshold={0.5}
      onEndReached={() => { if (query?.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage(); }}
      refreshControl={<RefreshControl tintColor={c.accent} colors={[c.accent]} refreshing={!!query?.isRefetching && !query?.isFetchingNextPage} onRefresh={() => query?.refetch()} />}
      keyboardShouldPersistTaps="handled"
    />
  );
}
