import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useArticles, useTaxonomy } from '../../lib/queries';
import { useTheme, spacing, radius, type } from '../../theme';
import ListScreen from '../../components/ListScreen';
import ArticleCard from '../../components/ArticleCard';
import { Empty, ErrorView, Tag, T } from '../../components/ui';

function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function Explore() {
  const c = useTheme();
  const { data: taxonomy } = useTaxonomy();
  const [subject, setSubject] = useState(null);
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  const articles = useArticles({ subject, q: q.length >= 2 ? q : undefined });
  const subjects = Object.entries(taxonomy?.subjects || {});

  return (
    <ListScreen
      query={articles}
      renderItem={({ item }) => <ArticleCard article={item} />}
      header={
        <View style={{ marginBottom: spacing.lg }}>
          <T variant="display" style={{ marginBottom: spacing.lg }}>Explore</T>
          <View style={[s.search, { borderColor: c.borderStrong }]}>
            <Ionicons name="search" size={18} color={c.textMuted} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Search topics, schemes, places"
              placeholderTextColor={c.textMuted}
              accessibilityLabel="Search articles"
              returnKeyType="search"
              style={[type.body, { flex: 1, color: c.text, paddingVertical: spacing.sm }]}
            />
            {text ? <Ionicons name="close-circle" size={18} color={c.textMuted} onPress={() => setText('')} accessibilityLabel="Clear search" /> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
            <Tag label="All subjects" active={!subject} onPress={() => setSubject(null)} />
            {subjects.map(([key, s2]) => <Tag key={key} label={s2.label} active={subject === key} onPress={() => setSubject(subject === key ? null : key)} />)}
          </ScrollView>
          {articles.error ? <ErrorView error={articles.error} onRetry={articles.refetch} /> : null}
        </View>
      }
      empty={articles.error ? null : <Empty icon="search-outline" title="Nothing found" message="Try another subject or search term." />}
    />
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
});
