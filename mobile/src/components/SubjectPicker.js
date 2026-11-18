import { View } from 'react-native';
import { useTaxonomy } from '../lib/queries';
import { SUBJECT_LABELS } from '../lib/subjects';
import { useT } from '../lib/i18n';
import { subjectLabel } from './ArticleCard';
import { tap } from '../lib/haptics';
import { spacing } from '../theme';
import { Tag } from './ui';

/** Multi-select chips for UPSC subjects. */
export default function SubjectPicker({ value, onChange }) {
  const { data: taxonomy } = useTaxonomy();
  const keys = Object.keys(taxonomy?.subjects || SUBJECT_LABELS);
  const { lang } = useT();
  const label = (k) => subjectLabel(taxonomy, k, lang);
  const toggle = (k) => { tap(); onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]); };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} accessibilityRole="list">
      {keys.map((k) => <Tag key={k} label={label(k)} active={value.includes(k)} onPress={() => toggle(k)} />)}
    </View>
  );
}
