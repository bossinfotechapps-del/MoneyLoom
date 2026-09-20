import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banknote, Pencil, Plus, Wallet } from 'lucide-react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { daysBetween, fmtDate, todayStr } from '../utils/dates';
import { compact, fmt } from '../utils/format';
import AccountSheet from './AccountSheet';
import AmountDialog from './AmountDialog';
import { Card, EmptyState, IconButton, KpiGrid, PrimaryButton, Tag } from './ui';

// A balance typed a while ago is probably out of date, so say so rather than pretending
const STALE_DAYS = 14;

/** Bank and cash accounts, with balances the person types in themselves. */
export default function AccountList({ onToast, bottomSpace }) {
  const { data, saveAccount, updateAccountBalance, removeAccount } = useData();
  const [sheet, setSheet] = useState(null);
  const [updating, setUpdating] = useState(null);
  const accounts = useMemo(() => data.accounts || [], [data.accounts]);
  const today = todayStr();

  const total = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0), [accounts]);
  const oldest = useMemo(
    () => accounts.reduce((old, a) => (!old || String(a.updatedOn) < String(old) ? a.updatedOn : old), null),
    [accounts]
  );

  if (!accounts.length) {
    return (
      <>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace }}>
          <EmptyState
            title="No accounts yet"
            body="Add your bank accounts and cash so your net worth includes what you actually hold. Balances are typed in by you — MoneyLoom never connects to a bank."
          >
            <PrimaryButton label="Add account" icon={<Plus size={18} color={C.white} />} onPress={() => setSheet({})} />
          </EmptyState>
        </ScrollView>
        {sheet && <AccountSheet initial={sheet} onSave={(a) => { saveAccount(a); onToast(`${a.name} added`); }} onDelete={removeAccount} onClose={() => setSheet(null)} />}
      </>
    );
  }

  const staleDays = oldest ? daysBetween(oldest, today) : 0;

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomSpace, gap: 12 }}>
        <KpiGrid
          items={[
            { label: 'In accounts', value: fmt(total), color: C.invest },
            {
              label: 'Accounts',
              value: String(accounts.length),
              note: staleDays > STALE_DAYS ? `Oldest balance ${staleDays} days old` : 'Balances are up to date',
              noteColor: staleDays > STALE_DAYS ? C.warn : undefined,
            },
          ]}
        />

        {accounts.map((a) => {
          const days = a.updatedOn ? daysBetween(a.updatedOn, today) : null;
          const stale = days !== null && days > STALE_DAYS;
          return (
            <Card key={a.id} style={s.card}>
              <View style={s.row}>
                <View style={s.icon}>
                  {a.type === 'Cash' || a.type === 'Wallet' ? <Wallet size={18} color={C.invest} /> : <Banknote size={18} color={C.invest} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[T.body, { fontWeight: '700' }]} numberOfLines={1}>
                    {a.name}{a.last4 ? ` ····${a.last4}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', marginTop: 3 }}>
                    <Tag label={a.type} />
                  </View>
                </View>
                <IconButton onPress={() => setSheet({ account: a })} label={`Edit ${a.name}`} size={36}>
                  <Pencil size={16} color={C.muted} />
                </IconButton>
              </View>

              <Pressable
                onPress={() => setUpdating(a)}
                android_ripple={{ color: C.lineSoft }}
                style={s.balance}
                accessibilityRole="button"
                accessibilityLabel={`Balance ${fmt(a.balance)}. Tap to update`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.amount, T.num]}>{fmt(a.balance)}</Text>
                  <Text style={[T.small, stale && { color: C.warn, fontWeight: '700' }]}>
                    {a.updatedOn ? `Updated ${fmtDate(a.updatedOn)}${stale ? ' · tap to refresh' : ''}` : 'Tap to set the balance'}
                  </Text>
                </View>
                <Text style={{ color: C.invest, fontWeight: '700' }}>Update</Text>
              </Pressable>
            </Card>
          );
        })}

        <PrimaryButton label="Add account" icon={<Plus size={18} color={C.white} />} onPress={() => setSheet({})} />
        <Text style={[T.small, { textAlign: 'center' }]}>
          {`Counted in your net worth as ${compact(total)}. Balances are yours to keep current.`}
        </Text>
      </ScrollView>

      {sheet && (
        <AccountSheet
          initial={sheet}
          onSave={(a) => {
            saveAccount(a);
            onToast(sheet.account ? 'Saved' : `${a.name} added`);
          }}
          onDelete={(id) => {
            removeAccount(id);
            onToast('Account removed');
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {updating && (
        <AmountDialog
          title={updating.name}
          subtitle="Copy what your banking app shows right now."
          label="Balance today (₹)"
          initial={updating.balance}
          onClose={() => setUpdating(null)}
          onSave={(amount) => {
            updateAccountBalance(updating.id, amount);
            onToast(`${updating.name} updated`);
          }}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  card: { padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E1F0ED', alignItems: 'center', justifyContent: 'center' },
  balance: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line,
  },
  amount: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: C.ink },
});
