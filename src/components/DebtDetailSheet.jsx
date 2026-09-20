import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Trash, TriangleAlert } from 'lucide-react-native';
import { C, T } from '../theme';
import { useData } from '../data/DataContext';
import { canPlanPayoff, computeDebt } from '../data/debts';
import { fmtDate, monthYear, todayStr } from '../utils/dates';
import { fmt, uid } from '../utils/format';
import AmountDateDialog from './AmountDateDialog';
import ConfirmPayments from './ConfirmPayments';
import DebtSheet from './DebtSheet';
import PayoffPlannerSheet from './PayoffPlannerSheet';
import { Bar, Card, GhostButton, IconButton, PrimaryButton } from './ui';
import SheetScreen from './SheetScreen';

function InfoRow({ label, value, color }) {
  return (
    <View style={s.info}>
      <Text style={[T.body, { color: C.muted, flex: 1 }]}>{label}</Text>
      <Text style={[T.body, T.num, { fontWeight: '700', color: color || C.ink }]}>{value}</Text>
    </View>
  );
}

export default function DebtDetailSheet({ debtId, onClose, onToast }) {
  const { data, saveDebt, updateDebt, removeDebt, confirmDebtEvent, recordDebtPayment } = useData();
  const debt = data.debts.find((d) => d.id === debtId);
  const [dialog, setDialog] = useState(null);
  const [editing, setEditing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const r = useMemo(() => (debt ? computeDebt(debt) : null), [debt]);

  if (!debt || !r) return null;
  const today = todayStr();
  const k = debt.kind;

  const history = [
    ...(debt.prepayments || []).map((x) => ({ ...x, list: 'prepayments', text: `Prepayment ${fmt(x.amount)}` })),
    ...(debt.overrides || []).map((x) => ({ ...x, list: 'overrides', text: `Amount left set to ${fmt(x.value)}` })),
    ...(debt.rateChanges || []).map((x) => ({ ...x, list: 'rateChanges', text: `Rate changed to ${x.rate}%` })),
    ...(debt.payments || []).map((x) => ({
      ...x, list: 'payments',
      text: k === 'lent' ? `Received ${fmt(x.amount)}` : k === 'card' ? `Paid ${fmt(x.amount)} on card` : `Repaid ${fmt(x.amount)}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const removeHistory = (item) => {
    Alert.alert('Remove this record?', `${item.text} on ${fmtDate(item.date)}`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => updateDebt(debt.id, (d) => ({ ...d, [item.list]: (d[item.list] || []).filter((x) => x.id !== item.id) })),
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(`Delete ${debt.name}?`, 'Its history is removed. Expenses already added from it stay in your list.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeDebt(debt.id);
          onToast('Deleted');
          onClose();
        },
      },
    ]);
  };

  const toggleClosed = () => {
    updateDebt(debt.id, (d) => ({ ...d, closed: !d.closed, closedOn: d.closed ? undefined : today }));
    onToast(debt.closed ? 'Reopened' : 'Marked as closed');
  };

  const add = (list, item) => updateDebt(debt.id, (d) => ({ ...d, [list]: [...(d[list] || []), { id: uid(), ...item }] }));

  // ---------- Headline ----------
  let headLabel = 'Left to pay';
  let headValue = r.owed;
  let headColor = C.loss;
  if (k === 'lent') {
    headLabel = 'They owe you';
    headValue = r.asset;
    headColor = C.invest;
  } else if (k === 'chit' && !r.taken) {
    headLabel = 'Paid in so far';
    headValue = r.paidIn;
    headColor = C.invest;
  }

  // ---------- Actions ----------
  const actions = [];
  if (canPlanPayoff(debt, r)) actions.push(['Pay off sooner', () => setPlanning(true)]);
  if (k === 'loan' || (k === 'gold' && debt.goldStyle === 'emi')) {
    actions.push(['Record prepayment', () => setDialog({ type: 'prepay' })]);
    actions.push(['Update amount left', () => setDialog({ type: 'override' })]);
    actions.push(['Change interest rate', () => setDialog({ type: 'rate' })]);
  }
  if (k === 'gold') actions.push(['Renew or change dates', () => setEditing(true)]);
  if (k === 'card') {
    actions.push(['Record payment', () => setDialog({ type: 'cardPay' })]);
    actions.push(['Enter new bill', () => setEditing(true)]);
  }
  if (k === 'hand') actions.push(['Record repayment', () => setDialog({ type: 'repay' })]);
  if (k === 'lent') actions.push(['Record money received', () => setDialog({ type: 'received' })]);
  if (k === 'chit') actions.push([r.taken ? 'Change chit taken details' : 'Mark chit as taken', () => setEditing(true)]);

  return (
    <SheetScreen
      title={debt.name}
      subtitle={`${debt.type}${debt.closed ? ', closed' : ''}`}
      action={{ label: 'Edit', onPress: () => setEditing(true) }}
      onClose={onClose}
    >
          <Card>
            <Text style={T.label}>{headLabel}</Text>
            <Text style={[s.big, T.num, { color: r.settled ? C.gain : headColor }]}>{r.settled ? 'Settled' : fmt(headValue)}</Text>
            {k !== 'card' && k !== 'gold' && (
              <>
                <View style={{ marginTop: 8 }}>
                  <Bar ratio={r.progress} color={C.invest} />
                </View>
                <Text style={[T.small, { marginTop: 4 }]}>
                  {k === 'chit' || k === 'paylater' ? `${r.paidCount} of ${r.total} paid` : `${Math.round(r.progress * 100)}% ${k === 'lent' ? 'received back' : 'repaid'}`}
                </Text>
              </>
            )}
            {r.overdue && (
              <View style={s.alert}>
                <TriangleAlert size={16} color={C.loss} />
                <Text style={[T.small, { color: C.loss, fontWeight: '700', flex: 1 }]}>
                  {k === 'card' ? `Overdue. Estimated interest so far ${fmt(r.estInterest)}.` : k === 'gold' ? 'Past maturity. Repay or renew to avoid penalties.' : 'Past the promised date.'}
                </Text>
              </View>
            )}
            {r.neverEnds && (
              <View style={s.alert}>
                <TriangleAlert size={16} color={C.loss} />
                <Text style={[T.small, { color: C.loss, fontWeight: '700', flex: 1 }]}>The EMI doesn’t cover the monthly interest, so this loan never ends. Check the EMI or rate.</Text>
              </View>
            )}
          </Card>

          <ConfirmPayments debtId={debt.id} max={12} />

          <Card style={{ paddingVertical: 6 }}>
            {(k === 'loan' || (k === 'gold' && debt.goldStyle === 'emi')) && (
              <>
                <InfoRow label="EMI" value={fmt(r.emi)} />
                <InfoRow label="Interest rate" value={`${r.annualRate}% a year`} />
                {r.studyPeriod && <InfoRow label="Study-period interest" value={`${fmt(r.monthlyOutgo)} a month`} />}
                <InfoRow label="Next payment" value={r.nextDue ? `${fmtDate(r.nextDue.date)}` : '—'} />
                <InfoRow label="EMIs paid" value={String(r.paidCount)} />
                <InfoRow label="Interest paid so far" value={fmt(r.interestPaid)} />
                <InfoRow label="Interest still to pay" value={fmt(r.interestRemaining)} color={C.loss} />
                <InfoRow label="Debt-free by" value={r.payoffDate ? monthYear(r.payoffDate) : r.settled ? 'Done' : '—'} color={C.gain} />
              </>
            )}
            {k === 'gold' && debt.goldStyle !== 'emi' && (
              <>
                <InfoRow label="Loan amount" value={fmt(debt.principal)} />
                {debt.grams ? <InfoRow label="Gold pledged" value={`${debt.grams} g`} /> : null}
                <InfoRow label="Interest rate" value={`${debt.rate}% a year`} />
                {debt.goldStyle === 'interestMonthly' ? (
                  <InfoRow label="Monthly interest" value={fmt(r.emi)} />
                ) : (
                  <InfoRow label="Interest so far" value={fmt(r.accruedInterest)} color={C.loss} />
                )}
                <InfoRow label="Maturity" value={fmtDate(debt.maturityDate)} color={r.overdue ? C.loss : C.ink} />
                {r.nextDue && <InfoRow label={r.nextDue.label} value={`${fmt(r.nextDue.amount)}, ${fmtDate(r.nextDue.date)}`} />}
              </>
            )}
            {k === 'card' && (
              <>
                <InfoRow label="Bill" value={fmt(debt.billAmount)} />
                <InfoRow label="Due date" value={debt.billDueDate ? fmtDate(debt.billDueDate) : '—'} color={r.overdue ? C.loss : C.ink} />
                <InfoRow label="Paid" value={fmt(r.billPaid)} color={C.gain} />
                <InfoRow label="Interest rate" value={`${debt.rate}% a year`} />
              </>
            )}
            {k === 'paylater' && (
              <>
                <InfoRow label="Instalment" value={fmt(debt.instalment)} />
                <InfoRow label="Instalments left" value={`${r.left} of ${r.total}`} />
                <InfoRow label="Next payment" value={r.nextDue ? fmtDate(r.nextDue.date) : '—'} />
              </>
            )}
            {(k === 'hand' || k === 'lent') && (
              <>
                <InfoRow label={k === 'lent' ? 'Amount lent' : 'Amount borrowed'} value={fmt(debt.principal)} />
                <InfoRow label="Principal left" value={fmt(r.principalLeft)} />
                <InfoRow label="Interest" value={debt.ratePerMonth ? `${debt.ratePerMonth}% a month` : 'None'} />
                {debt.ratePerMonth ? <InfoRow label="Interest due" value={fmt(r.interestDue)} /> : null}
                <InfoRow label={k === 'lent' ? 'Received so far' : 'Repaid so far'} value={fmt(r.repaid)} color={C.gain} />
                <InfoRow label={k === 'lent' ? 'Expected back by' : 'Promised by'} value={debt.promisedDate ? fmtDate(debt.promisedDate) : '—'} color={r.overdue ? C.loss : C.ink} />
              </>
            )}
            {k === 'chit' && (
              <>
                <InfoRow label="Monthly instalment" value={fmt(debt.instalment)} />
                <InfoRow label="Instalments paid" value={`${r.paidCount} of ${r.total}`} />
                <InfoRow label="Taken" value={r.taken ? `${fmtDate(debt.takenDate)}, received ${fmt(debt.receivedAmount)}` : 'Not yet'} />
                {r.taken && <InfoRow label="Still to pay" value={fmt(r.owed)} color={C.loss} />}
                <InfoRow label="Next instalment" value={r.nextDue ? fmtDate(r.nextDue.date) : '—'} />
              </>
            )}
          </Card>

          {r.missed.length > 0 && (
            <Card>
              <Text style={[T.h3, { marginBottom: 4 }]}>Marked as not paid</Text>
              {r.missed.map((ev) => (
                <View key={ev.key} style={s.historyRow}>
                  <Text style={[T.body, { flex: 1 }]}>{`${ev.label}, ${fmtDate(ev.date)}, ${fmt(ev.amount)}`}</Text>
                  <GhostButton label="Mark paid" onPress={() => confirmDebtEvent(debt.id, ev, true)} style={{ paddingVertical: 6, paddingHorizontal: 10 }} />
                </View>
              ))}
            </Card>
          )}

          <View style={{ gap: 10 }}>
            {actions.map(([label, fn], i) => (i === 0 ? <PrimaryButton key={label} label={label} onPress={fn} /> : <GhostButton key={label} label={label} onPress={fn} />))}
          </View>

          {history.length > 0 && (
            <Card>
              <Text style={[T.h3, { marginBottom: 4 }]}>History</Text>
              {history.slice(0, 20).map((item) => (
                <View key={`${item.list}-${item.id}`} style={s.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={T.body}>{item.text}</Text>
                    <Text style={T.small}>{fmtDate(item.date)}</Text>
                  </View>
                  <IconButton onPress={() => removeHistory(item)} label={`Remove ${item.text}`} size={36}>
                    <Trash size={16} color={C.muted} />
                  </IconButton>
                </View>
              ))}
            </Card>
          )}

          {debt.note ? <Text style={T.small}>{debt.note}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <GhostButton label={debt.closed ? 'Reopen' : 'Mark as closed'} onPress={toggleClosed} style={{ flex: 1 }} />
            <GhostButton label="Delete" color={C.loss} icon={<Trash size={16} color={C.loss} />} onPress={confirmDelete} style={{ flex: 1 }} />
          </View>


      {dialog?.type === 'prepay' && (
        <AmountDateDialog
          title="Record prepayment"
          subtitle="The EMI stays the same and the loan ends sooner."
          saveLabel="Record"
          onClose={() => setDialog(null)}
          onSave={({ amount, date }) => {
            add('prepayments', { date, amount });
            onToast('Prepayment recorded');
          }}
        />
      )}
      {dialog?.type === 'override' && (
        <AmountDateDialog
          title="Update amount left"
          subtitle="Enter the outstanding amount shown in your bank app. EMIs after this date continue from it."
          label="Amount left (₹)"
          initialAmount={r.owed}
          allowZero
          onClose={() => setDialog(null)}
          onSave={({ amount, date }) => {
            add('overrides', { date, value: amount });
            onToast('Amount left updated');
          }}
        />
      )}
      {dialog?.type === 'rate' && (
        <AmountDateDialog
          title="Change interest rate"
          subtitle="For floating-rate loans. Applies from the date you pick."
          label="New rate (% a year)"
          initialAmount={r.annualRate}
          dateLabel="Applies from"
          onClose={() => setDialog(null)}
          onSave={({ amount, date }) => {
            add('rateChanges', { date, rate: amount });
            onToast('Rate updated');
          }}
        />
      )}
      {dialog?.type === 'cardPay' && (
        <AmountDateDialog
          title="Record card payment"
          subtitle="Not added to expenses: the card spends were already logged."
          initialAmount={Math.max(0, (Number(debt.billAmount) || 0) - (r.billPaid || 0))}
          saveLabel="Record"
          onClose={() => setDialog(null)}
          onSave={({ amount, date }) => {
            add('payments', { date, amount });
            onToast('Payment recorded');
          }}
        />
      )}
      {dialog?.type === 'repay' && (
        <AmountDateDialog
          title="Record repayment"
          subtitle="Interest due is cleared first, then the principal."
          switchLabel="Add to my expenses"
          switchInitial
          saveLabel="Record"
          onClose={() => setDialog(null)}
          onSave={({ amount, date, switchOn }) => {
            recordDebtPayment(debt.id, { id: uid(), date, amount }, switchOn);
            onToast('Repayment recorded');
          }}
        />
      )}
      {dialog?.type === 'received' && (
        <AmountDateDialog
          title="Record money received"
          subtitle="Not counted as income: it’s your own money coming back."
          initialAmount={r.asset}
          saveLabel="Record"
          onClose={() => setDialog(null)}
          onSave={({ amount, date }) => {
            add('payments', { date, amount });
            onToast('Money received recorded');
          }}
        />
      )}

      {planning && <PayoffPlannerSheet debtId={debt.id} onClose={() => setPlanning(false)} />}

      {editing && (
        <DebtSheet
          initial={{ debt }}
          onClose={() => setEditing(false)}
          onSave={(d) => {
            saveDebt(d);
            onToast('Saved');
          }}
        />
      )}
    </SheetScreen>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.surface },
  big: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: '#FCEBEB', borderRadius: 10, padding: 10 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft },
});
