import { View } from 'react-native';
import { useTaxonomy } from '../lib/queries';
import { EXAM_KEYS, examLabel } from '../lib/subjects';
import { useT } from '../lib/i18n';
import { tap } from '../lib/haptics';
import { spacing } from '../theme';
import { Tag } from './ui';

/** Multi-select chips for the exams the user is preparing for. */
export default function ExamPicker({ value, onChange }) {
  const { data: taxonomy } = useTaxonomy();
  const { lang } = useT();
  const keys = Object.keys(taxonomy?.exams || {}).length ? Object.keys(taxonomy.exams) : EXAM_KEYS;
  const label = (k) => (lang === 'hi' ? taxonomy?.exams?.[k]?.labelHi : taxonomy?.exams?.[k]?.label) || examLabel(k, lang);
  const toggle = (k) => { tap(); onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]); };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} accessibilityRole="list">
      {keys.map((k) => <Tag key={k} label={label(k)} active={value.includes(k)} onPress={() => toggle(k)} />)}
    </View>
  );
}
