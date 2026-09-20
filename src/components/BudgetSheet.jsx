import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, Trash, Wand } from 'lucide-react-native';
import { C, T } from '../theme';
import { categoriesFor, categoryUsage } from '../data/compute';
import { useData } from '../data/DataContext';
import { monthlyToWeekly, weeklyToMonthly } from '../utils/dates';
import { fmt, toNumber } from '../utils/format';
import SheetScreen from './SheetScreen';
import { useEnsureVisible } from './KeyboardAwareScroll';
import TextPromptDialog from './TextPromptDialog';
import { GhostButton, IconButton, PrimaryButton, Segmented } from './ui';

// Categories most households treat as needs, used by the suggested budget
const NEEDS = ['Rent & housing', 'EMI & loans', 'Bills & utilities', 'Groceries & food', 'Fuel & transport', 'Health', 'Education'];
const WANTS = ['Eating out', 'Shopping', 'Entertainment', 'Subscriptions', 'Family & gifts', 'Other'];

// One row per category, outside the sheet and memoised so typing keeps focus
const BudgetRow = memo(function BudgetRow({ category, value, spent, periodWord, onChange, onRemove, fixedMonthly, onToggleFixed }) {
  const inputRef = useRef(null);
  const ensureVisible = useEnsureVisible();
  return (
    <View style={[s.row, { flexWrap: 'wrap' }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{category}</Text>
        <Text style={T.small} numberOfLines={1}>Spent this {periodWord} {fmt(spent)}</Text>
      </View>
      <View style={s.inputWrap}>
        <Text style={s.rupee}>₹</Text>
        <TextInput
          ref={inputRef}
          onFocus={() => ensureVisible && ensureVisible(inputRef.current)}
          value={value}
          onChangeText={(v) => onChange(category, v)}
          keyboardType="number-pad"
          placeholder="No limit"
          placeholderTextColor="#98A39F"
          selectTextOnFocus
          style={s.input}
          accessibilityLabel={`Budget for ${category}`}
        />
      </View>
      <IconButton onPress={() => onRemove(category)} label={`Remove ${category}`} size={34}>
        <Trash size={15} color={C.muted} />
      </IconButton>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!fixedMonthly }}
        accessibilityLabel={`${category}: fixed monthly payment`} onPress={() => onToggleFixed(category)}
        style={{ width: '100%', paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: C.invest, fontSize: 17 }}>{fixedMonthly ? '☑' : '□'}</Text>
        <Text style={T.small}>Fixed monthly payment (track paid status in Week view)</Text>
      </Pressable>
    </View>
  );
});

/**
 * Budget per expense category, set either weekly (Monday to Sunday) or monthly.
 * Props: budgets, budgetPeriod, spentByCategory, typicalIncome, onSave(budgets, period), onClose
 */
export default function BudgetSheet({ budgets, budgetPeriod = 'monthly', spentByCategory, typicalIncome = 0, onSave, onClose }) {
  const { data, addCategory, removeCategory } = useData();
  const [period, setPeriod] = useState(budgetPeriod === 'weekly' ? 'weekly' : 'monthly');
  const [newCategory, setNewCategory] = useState(false);
  const [fixed, setFixed] = useState(() => ({ ...(data.fixedMonthlyCategories || {}) }));
  const toggleFixed = useCallback((cat) => setFixed(prev => ({ ...prev, [cat]: !prev[cat] })), []);

  const categories = useMemo(() => {
    const list = categoriesFor(data, 'expense');
    return [...list, ...Object.keys(budgets).filter((c) => !list.includes(c))];
  }, [data, budgets]);

  const [values, setValues] = useState(() =>
    Object.fromEntries(categories.map((c) => [c, budgets[c] ? String(budgets[c]) : '']))
  );
  const onChange = useCallback((cat, v) => setValues((prev) => ({ ...prev, [cat]: v })), []);

  const periodWord = period === 'weekly' ? 'week' : 'month';
  const total = Object.entries(values).reduce((sum, [cat, v]) => sum + (!fixed[cat] && toNumber(v) > 0 ? toNumber(v) : 0), 0);

  // Switching period offers to convert the amounts, since ₹10,000 a month isn't ₹10,000 a week
  const switchPeriod = (next) => {
    if (next === period) return;
    const hasAmounts = Object.entries(values).some(([cat, v]) => !fixed[cat] && toNumber(v) > 0);
    const apply = (convert) => {
      setPeriod(next);
      if (!convert) return;
      setValues((prev) => {
        const out = {};
        Object.entries(prev).forEach(([cat, v]) => {
          const n = toNumber(v);
          out[cat] = n > 0 && !fixed[cat] ? String(next === 'weekly' ? monthlyToWeekly(n) : weeklyToMonthly(n)) : v;
        });
        return out;
      });
    };
    if (!hasAmounts) {
      apply(false);
      return;
    }
    Alert.alert(
      next === 'weekly' ? 'Switch to weekly budgets?' : 'Switch to monthly budgets?',
      next === 'weekly'
        ? 'Your amounts can be divided across the weeks of a month, or kept as they are.'
        : 'Your amounts can be multiplied up to a month, or kept as they are.',
      [
        { text: 'Keep amounts', onPress: () => apply(false) },
        { text: 'Convert them', onPress: () => apply(true) },
      ]
    );
  };

  // Half for needs, a third for wants, the rest saved
  const applyStarter = () => {
    if (!(typicalIncome > 0)) {
      Alert.alert('Income needed first', 'Log at least one month of income and this can suggest limits based on what you actually earn.');
      return;
    }
    const income = period === 'weekly' ? monthlyToWeekly(typicalIncome) : Math.round(typicalIncome);
    const needsPool = income * 0.5;
    const wantsPool = income * 0.3;
    const usedNeeds = NEEDS.filter((c) => categories.includes(c) && !fixed[c]);
    const usedWants = WANTS.filter((c) => categories.includes(c) && !fixed[c]);
    if (!usedNeeds.length && !usedWants.length) return;
    Alert.alert(
      'Suggest limits from your income?',
      `Based on ${fmt(income)} a ${periodWord}: ${fmt(needsPool)} across needs, ${fmt(wantsPool)} across wants, and the rest left to save. This replaces the amounts below.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suggest',
          onPress: () => {
            const next = {};
            categories.forEach((c) => {
              next[c] = '';
            });
            const share = (pool, list) => (list.length ? Math.max(50, Math.round(pool / list.length / 50) * 50) : 0);
            usedNeeds.forEach((c) => {
              next[c] = String(share(needsPool, usedNeeds));
            });
            usedWants.forEach((c) => {
              next[c] = String(share(wantsPool, usedWants));
            });
            setValues(prev => Object.fromEntries(categories.map(cat => [cat, fixed[cat] ? prev[cat] : next[cat]])));
          },
        },
      ]
    );
  };

  const removeRow = useCallback(
    (category) => {
      const custom = (data.customCategories?.expense || []).includes(category);
      const usage = categoryUsage(data, category);
      const clear = () => { setValues((prev) => ({ ...prev, [category]: '' })); setFixed(prev => ({ ...prev, [category]: false })); };
      const buttons = [{ text: 'Cancel', style: 'cancel' }];
      if (values[category]) buttons.push({ text: 'Clear the limit', onPress: clear });
      if (custom) {
        buttons.push({
          text: 'Remove category',
          style: 'destructive',
          onPress: () => {
            removeCategory('expense', category);
            clear();
          },
        });
      }
      if (buttons.length === 1) return;
      Alert.alert(
        category,
        custom
          ? usage.entries
            ? `${usage.entries} ${usage.entries === 1 ? 'entry keeps' : 'entries keep'} this name if you remove the category.`
            : 'This category is one you added, and nothing uses it.'
          : 'Built-in categories stay in the list. You can clear the limit.',
        buttons
      );
    },
    [data, values, removeCategory]
  );

  const save = () => {
    const out = {};
    Object.entries(values).forEach(([cat, v]) => {
      const n = toNumber(v);
      if (n > 0 && !Number.isNaN(n)) out[cat] = Math.round(n);
    });
    onSave(out, period, Object.fromEntries(Object.keys(out).filter(cat => fixed[cat]).map(cat => [cat, true])));
    onClose();
  };

  return (
    <SheetScreen
      title={'Budgets'}
      action={{ label: 'Save', onPress: save }}
      onClose={onClose}
      background={C.surface}
    >
          <Segmented options={[['weekly', 'Weekly'], ['monthly', 'Monthly']]} value={period} onChange={switchPeriod} />
          <Text style={[T.body, { color: C.muted, lineHeight: 22, marginTop: 12 }]}>
            {period === 'weekly'
              ? 'Limits run Monday to Sunday and start fresh each week. Good for groceries, eating out and travel.'
              : 'Limits run for the calendar month. Good for rent, EMIs and bills.'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <Text style={[T.h3, { flex: 1 }]}>Flexible limits {fmt(total)} a {periodWord}</Text>
            <GhostButton
              label="Suggest"
              icon={<Wand size={15} color={C.invest} />}
              color={C.invest}
              onPress={applyStarter}
              style={{ paddingVertical: 6, paddingHorizontal: 10 }}
            />
          </View>

          <Text style={[T.small, { marginTop: 10 }]}>Tick fixed monthly payments such as Gym Fee or rent. Enter their FULL monthly amount, even when your other budgets are weekly.</Text>
          <View style={s.card}>
            {categories.map((c) => (
              <BudgetRow
                key={c}
                category={c}
                value={values[c] ?? ''}
                spent={fixed[c] ? data.entries.reduce((sum, e) => sum + (e.kind === 'expense' && e.category === c && e.date?.slice(0, 7) === new Date().toISOString().slice(0, 7) ? Number(e.amount) || 0 : 0), 0) : spentByCategory[c] || 0}
                periodWord={fixed[c] ? 'month' : periodWord}
                onChange={onChange}
                onRemove={removeRow}
                fixedMonthly={!!fixed[c]}
                onToggleFixed={toggleFixed}
              />
            ))}
          </View>

          <GhostButton label="New category" icon={<Plus size={16} color={C.ink} />} onPress={() => setNewCategory(true)} style={{ marginTop: 12 }} />
          <PrimaryButton label="Save budgets" onPress={save} style={{ marginTop: 12 }} />

      {newCategory && (
        <TextPromptDialog
          title="New expense category"
          subtitle="It appears here and when adding an entry."
          label="Category name"
          placeholder="e.g. Insurance"
          onClose={() => setNewCategory(false)}
          onSave={(name) => {
            const result = addCategory('expense', name);
            if (!result) return { error: 'Enter a category name.' };
            setValues((prev) => ({ ...prev, [result.name]: prev[result.name] ?? '' }));
            return null;
          }}
        />
      )}
    </SheetScreen>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  row: {
    height: 68, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 14, paddingRight: 4, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line, backgroundColor: C.white,
  },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#CBD5CF', borderRadius: 10, paddingLeft: 10, width: 118, backgroundColor: C.white },
  rupee: { color: C.muted, fontWeight: '700' },
  input: { flex: 1, fontSize: 16, color: C.ink, paddingVertical: 8, paddingHorizontal: 6 },
});
