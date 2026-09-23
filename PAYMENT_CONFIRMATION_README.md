# MoneyLoom payment-confirmation update

This patch adds the **Paid / Received**, **Not paid**, and **Remind me later** choices to due monthly repeats, future-dated one-off entries and investments, debts configured with **Ask me** payment recording, plus one-off card bills and informal-loan promised payments. Confirming an amount opens an amount/date form. No scheduled transaction is counted as an actual payment or receipt merely because the due date passes.

## Monthly repeats

- New repeats ask for confirmation. Previously saved occurrences remain in the ledger; existing rules now use **Ask me** unless explicitly set to **Auto** under **More → Monthly repeats**.
- After a missed payment, a later confirmation can allocate part of the **one actual payment** to the older month by enabling **Cover earlier unpaid months first**. With the switch off, an extra contribution remains part of the current actual payment; the missed month stays unpaid.
- Partial payments leave an unpaid amount on the schedule. Previously recorded matching manual transactions can be linked to a monthly repeat from the confirmation dialog, rather than added again. Different real partial payments are separate real transactions.
- Financial reports and holdings exclude future-dated planned entries until their payment or receipt is confirmed.

## Debts and scheduled items

- Debts set to **Ask me** support confirming actual amount/date, partial instalments, and marking Not paid or Remind me later. Debt types with **Auto** continue using their existing auto-record mode.
- One-off credit-card bills, borrowed hand-loan repayments and lent-money receipts can also be confirmed after their due date. Card repayment is **not** added as a second expense; money lent being returned is **not** new income. The existing Debt detail actions remain available. Other special-case payments such as gold-loan principal at maturity still use their existing debt-detail actions.
- Remind me later retains an awaiting-confirmation status. It does **not** create an additional scheduled device notification; background reminder verification is still pending.

## Install / verify

Back up or commit your current working project, then extract this changed-files ZIP directly into the root folder of that version. Rebuild and install the Android app. Verify a due monthly investment, a salary receipt, a partially paid EMI, and a missed-then-covered month. Check current holdings, budget cards, week/month/FY reports, and upcoming dues for double-counting. This patch is not a Google Play release build.
