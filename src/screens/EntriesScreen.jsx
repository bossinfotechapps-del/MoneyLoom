import React, { memo, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, Search, Trash, X } from 'lucide-react-native';
import { C, T } from '../theme';
import { categoriesFor } from '../data/compute';
import { useData } from '../data/DataContext';
import { currentMonth, fmtDate, monthKey, monthLabel, shortMonthName } from '../utils/dates';
import { fmt } from '../utils/format';
import { ChipScroller, EmptyState, IconButton, PrimaryButton, Segmented, Tag } from '../components/ui';
import { useEnsureVisible } from '../components/KeyboardAwareScroll';

// Defined outside the screen and memoised so the keyboard stays open while typing
const SearchBox = memo(function SearchBox({ value, onChange }) {
  const inputRef = useRef(null);
  const ensureVisible = useEnsureVisible();
  return (
    <View style={s.search}>
      <Search size={17} color={C.muted} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        onFocus={() => ensureVisible && ensureVisible(inputRef.current)}
        placeholder="Search notes, e.g. petrol"
        placeholderTextColor="#98A39F"
        style={s.searchInput}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
          <X size={16} color={C.muted} />
        </Pressable>
      ) : null}
    </View>
  );
});

const EntryRow = memo(function EntryRow({ entry, onEdit, onDelete }) {
  const income = entry.kind === 'income';
  return (
    <Pressable onPress={() => onEdit(entry)} android_ripple={{ color: C.lineSoft }} style={s.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{entry.note || entry.category}</Text>
        <View style={s.meta}>
          <Tag label={entry.category} />
          {entry.planned && <Tag label="Planned · not confirmed" />}
          <Text style={T.small}>{entry.mode}</Text>
        </View>
      </View>
      <Text style={[T.body, T.num, { fontWeight: '700', color: income ? C.earn : C.ink }]}>
        {income ? '+' : '−'}{fmt(entry.amount)}
      </Text>
      <IconButton onPress={() => onDelete(entry)} label={`Delete ${entry.note || entry.category}`} size={36}>
        <Trash size={17} color={C.muted} />
      </IconButton>
    </Pressable>
  );
});

export default function EntriesScreen({ onAdd, onEdit, bottomSpace }) {
  const { data, months, removeRecord } = useData();
  const [fMonth, setFMonth] = useState(currentMonth());
  const [fKind, setFKind] = useState('all');
  const [fCat, setFCat] = useState('all');
  const [q, setQ] = useState('');

  const catOptions = useMemo(() => {
    const list = [...categoriesFor(data, 'expense'), ...categoriesFor(data, 'income')];
    return [['all', 'All categories'], ...list.map((c) => [c, c])];
  }, [data]);

  const monthOptions = useMemo(() => [['all', 'All months'], ...months.map((k) => [k, monthLabel(k)])], [months]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.entries
      .filter(
        (e) =>
          (fMonth === 'all' || monthKey(e.date) === fMonth) &&
          (fKind === 'all' || e.kind === fKind) &&
          (fCat === 'all' || e.category === fCat) &&
          (!needle || `${e.note} ${e.category} ${e.mode}`.toLowerCase().includes(needle))
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.entries, fMonth, fKind, fCat, q]);

  const sections = useMemo(() => {
    const out = [];
    rows.forEach((e) => {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.data.push(e);
      else out.push({ date: e.date, data: [e] });
    });
    return out;
  }, [rows]);

  const spent = rows.reduce((sum, e) => sum + (!e.planned && e.kind === 'expense' ? e.amount : 0), 0);
  const earned = rows.reduce((sum, e) => sum + (!e.planned && e.kind === 'income' ? e.amount : 0), 0);

  const confirmDelete = (entry) => {
    Alert.alert('Delete this entry?', `${entry.note || entry.category}, ${fmt(entry.amount)} on ${fmtDate(entry.date)}`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeRecord('entries', entry.id) },
    ]);
  };

  const header = (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      <ChipScroller options={monthOptions} value={fMonth} onChange={setFMonth} />
      <Segmented options={[['all', 'All'], ['expense', 'Expenses'], ['income', 'Income']]} value={fKind} onChange={setFKind} />
      <SearchBox value={q} onChange={setQ} />
      <ChipScroller options={catOptions} value={fCat} onChange={setFCat} />
      <View style={s.totals}>
        <Text style={T.small}>Entries <Text style={[s.total, { color: C.ink }]}>{rows.length}</Text></Text>
        <Text style={T.small}>Spent <Text style={[s.total, { color: C.spend }]}>{fmt(spent)}</Text></Text>
        <Text style={T.small}>Earned <Text style={[s.total, { color: C.earn }]}>{fmt(earned)}</Text></Text>
      </View>
    </View>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace }}
      renderSectionHeader={({ section }) => <Text style={s.dateHeader}>{fmtDate(section.date)}</Text>}
      renderItem={({ item, index, section }) => (
        <View
          style={[
            s.rowWrap,
            index === 0 && s.first,
            index === section.data.length - 1 && s.last,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
          ]}
        >
          <EntryRow entry={item} onEdit={onEdit} onDelete={confirmDelete} />
        </View>
      )}
      ListEmptyComponent={
        data.entries.length === 0 ? (
          <EmptyState title="No entries yet" body="Log what you spend and earn. Tap Add to record your first expense.">
            <PrimaryButton label="Add expense" icon={<Plus size={18} color={C.white} />} onPress={onAdd} />
          </EmptyState>
        ) : (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <Text style={T.small}>
              No entries match these filters{fMonth !== 'all' ? ` in ${shortMonthName(fMonth)}` : ''}.
            </Text>
          </View>
        )
      }
    />
  );
}

const s = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 8, backgroundColor: C.white,
    borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 13,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 10 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 2 },
  total: { fontWeight: '800', fontSize: 14 },
  dateHeader: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, color: C.muted, marginTop: 18, marginBottom: 8 },
  rowWrap: { backgroundColor: C.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.line, overflow: 'hidden' },
  first: { borderTopWidth: 1, borderTopLeftRadius: 17, borderTopRightRadius: 17 },
  last: { borderBottomWidth: 1, borderBottomLeftRadius: 17, borderBottomRightRadius: 17 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 62, gap: 8, paddingLeft: 14, paddingRight: 4, paddingVertical: 13 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
});
