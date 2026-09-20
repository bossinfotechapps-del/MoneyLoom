# MoneyLoom changelog

## Build notes

- Play billing is switched off in debug builds (src/premium/premiumConfig.js). It can only work in a build installed from Google Play, and leaving it on made the library log a connection error on every launch, which React Native shows as a red box. Test purchases from the Play internal testing track
- Google sign-in fetches both the ID token and the access token via GoogleSignin.getTokens(). Passing the ID token alone makes react-native-firebase send an empty access token, and the native SDK throws "accessToken cannot be empty"

- @react-native-firebase pinned to 25.0.0: v26 refuses to build without the New Architecture
- react-native-google-mobile-ads pinned to 16.0.0: 16.3+ requires the New Architecture (codegen `NativeAppModuleSpec`), and its Ads SDK 25.x is compiled with Kotlin 2.3 while this project uses Kotlin 2.1.20

## 1.0.0 (first Play release, not yet published)

Core
- Overview: month summary, 12-month chart, categories vs last month, spending pace, biggest spends, portfolio
- Expenses & income list with filters and search; Investments with holdings and value updates
- Backup/restore, CSV import/export, sample data
- AdMob banner with consent

Added in this update
- R1 Remove ads one-time purchase (Play Billing 8 via react-native-iap 16), with restore and refund handling; ads SDK never loads for buyers
- R2 Monthly repeats: Repeat every month toggle on Add entry; auto-posts due months on launch/resume; clamps day 29–31 to month end; pause/resume (no back-fill of paused months), change amount, delete (past entries kept)
- R3 Monthly budgets per expense category: budget sheet, Overview shows left/over per category and in total, amber near 85%, red over
- R4 Daily reminder notification (notifee): time picker, permission only when turned on, tap opens Add expense, rescheduled on launch
- R5 Adaptive launcher icon with Android 13 themed icon, white notification icon, Play Store icon and feature graphic
- Data tab renamed More
- R22 Upcoming payments: a "Next 30 days" card on Overview listing EMIs, gold loan interest, card bills, pay-later and chit instalments, promised repayments and monthly repeats, with going-out and coming-in totals and a warning for payments still waiting to be confirmed. Each debt card now also shows its next payment and date
- R26 Weekly budgets: a Week/Month switch on Overview and in Budgets, with weeks running Monday to Sunday and starting fresh each week. Switching period offers to convert the amounts, and a budget set in one period is converted when viewed in the other. Overview's chart, categories, pace sentence and biggest spends all follow the selected period
- R18 New categories can be created from the Budgets screen, not just while adding an entry
- R30 Suggest button fills budget limits from your typical income: half across needs, a third across wants, the rest left to save
- Shared layout: every full-screen sheet now uses one SheetScreen shell (header, scrolling body, keyboard handling, bottom safe space) and every small dialog uses one DialogShell (scrolling body with the buttons pinned outside it). Scrolling, focused-input visibility and reachable bottom actions are now solved in two components rather than eleven screens, so the same problem can't come back on a new screen
- Fixed: on a loan, the Delete and Mark as closed buttons at the bottom could sit under the navigation bar. Bottom padding now always includes the safe-area inset, on every sheet
- Fixed: dialogs with a date field or a long hint could push their Cancel and Save buttons off a short screen with the keyboard open. The body scrolls inside the space that is left, and the buttons stay put
- R41 Category analytics now match Overview: a Week / Month switch, the last 6 periods instead of 12, month labels as Apr-26 and week labels as their start date (7-Sep), the amount printed above each bar, and the budget line and figures following whichever period is chosen
- Fixed: cloud backup could spin for ever. Firestore only settles a write once the server confirms it, so a missing database or unpublished rules left the promise pending. Every cloud call now has a 20-second deadline and says what to check
- R36 Trend charts now show the last 6 periods instead of 12, so bars are wide enough to read, each carries its total above it, and every period keeps its own label
- R37 Month labels read Apr-26, Sep-26; week labels read by start date, 7-Sep or 7-Sep-26 where there is room. Same labels on the category, saving rate and FY charts
- R38 Under each trend chart, a line naming the selected period with its exact spent, invested and earned figures, so the numbers are readable without tapping a bar
- R39 Layout: KPI values larger and tighter, chart heights and spacing evened out, legends and axis labels kept clear of each other
- R40 Backup and restore report properly: a toast that says "Backing up…", then turns into success with what was saved, or failure with the actual reason. Covers cloud backup, cloud restore, file save, file share and file restore
- R32 Budget rows can be removed: a bin on each row clears the limit, and for a category you created yourself it offers to remove the category too (entries keep the name)
- R33 Budget screen no longer jumps while typing: the keyboard space is a spacer rather than changing padding on the content, rows have a fixed height so the list can't reflow, only one scroll is ever pending, and amounts select on focus
- R34 Financial year on Overview: a third Week / Month / FY switch. Runs 1 April to 31 March, with earned, spent, invested and left over for the year, a month-by-month chart you can tap to open a month, top categories against the same point last FY, and the total invested in the year
- R35 EMIs and dues screen: "See all" on the Next 30 days card, and a button on the Debts tab. Shows 30, 60 or 90 days grouped by month, with anything overdue called out and payments still waiting to be confirmed at the top
- R21 Bank and cash accounts: a new Accounts section on the Wealth tab. Add savings, salary, current, wallet or cash accounts with the balance you see in your banking app, tap a balance to update it, and edit or remove any of them. Balances count towards net worth, a balance older than two weeks is flagged as needing a refresh, and only the last 4 digits can be stored — never a full account number. No bank connection: every figure is typed in by the person
- Keyboard, everywhere: a Done bar now sits above the keyboard (Android's number pad has no Done key, so people had to guess that tapping the background closes it); the focused field is scrolled back into view when the keyboard opens or changes height, not only when the field is first tapped; amount fields select their contents so typing replaces the old number; Enter moves to the next field where there is one; and the Expenses search box scrolls clear of the keyboard too
- R29 Payoff planner: on any loan, gold loan, pay-later or hand loan, pick an extra monthly amount and see the new debt-free month, months saved and interest saved. With more than one debt, compare "costliest first" against "smallest first" and jump to whichever you choose. Refuses to pretend when the payment doesn't cover the monthly interest, and reminds you to check prepayment fees with the lender
- R23 Smarter cloud backup: once a day instead of hourly, and only when the data actually changed (a cheap fingerprint check). Failures are remembered, retried after 15 minutes, and shown honestly in More ("Last backup failed", plus the reason). The last 5 copies are kept under users/{uid}/versions, so Restore can offer an older one, and deleting the account removes them all
- R28 Saving rate card on Overview: the last six months of (earned − spent) ÷ earned as a line, with the current rate, whether the recent half is above or below the older half, and the best month so far. Hidden until two months have income, since one month says nothing
- R31 Category trend: tap any category on Overview (or long-press a donut legend row) for its last 12 months as a chart, the monthly average, highest month, year total, whether the last 3 months are rising or falling, the budget drawn as a dashed line, and the entries behind whichever month you tap
- Fixed overlapping month and week names on chart axes: labels are now thinned to what actually fits, keeping an even spread and always keeping the most recent one
- R27 "Adds up quietly" card on Overview: finds the same note bought four or more times, six or more small spends (under ₹300) in one category, and any category running 40% above its usual level over the last three periods. Up to three findings, biggest first, one per category, following the week or month on screen. Offers to set a limit for a category that has none
- R19 Backup fixed: "Back up everything" and "Export CSV" now ask whether to save into the phone's Downloads folder or open the share sheet. Saving to Downloads always works, even with no Drive or Files app installed, and a toast confirms where the file went. Closing the share sheet is no longer treated as an error, and cloud backup errors now name the cause (rules not published, no database, signed out, offline, quota)
- Removed (not useful): Overview portfolio section (now a net worth line that opens Wealth), spending pace chart (now one sentence comparing with the same day last month), full-screen interstitial ads (banner only), chit value field, Load sample data in More (still on the empty Overview), separate investments CSV export
- R15 First run: native splash screen with the app logo (Android 12+ splash API, with a fallback for older versions), and a welcome screen with the logo, what the app does, "Continue with Google" and "Use without an account". The choice is remembered
- R16 Accounts: optional Google sign-in (Firebase Auth), account card in More with name, email, sign out, and Delete account, which removes the cloud copy and unlinks Google. Firebase is optional at build time: with no google-services.json the app still builds and runs with sign-in switched off
- R17 Cloud backup: one Firestore document per user, backed up on demand and automatically when leaving the app (at most hourly), with restore, a size guard under Firestore's 1 MB document limit, and rules in firestore.rules
- Legal and store pages: terms of use, account deletion page (required by Play once accounts exist), updated privacy policy, plus Privacy, Terms and Contact links in More
- Fixed: the keyboard covered the form when adding an entry. Android 15+ ignores window resizing for edge-to-edge apps, and a full-screen Modal never resizes, so every sheet and dialog now measures the keyboard itself, pads the content and scrolls the focused field above it
- Custom categories: "+ New category" while adding an entry, plus add and remove under More > Your categories. Custom categories appear in budgets and in the Expenses filters; removing one keeps existing entries and drops only its budget
- Smaller fixes: clear button in the Expenses search box, and lists close the keyboard when you scroll
- R9 Debts: home, vehicle, personal, education, loan against property and other bank loans (reducing-balance EMI, prepayments, rate changes, bank balance override, payoff date, interest paid and still to pay); gold loans (interest monthly, all at end, or EMI); credit cards (bill, payments, overdue interest estimate); no-cost EMI / pay later; hand loans with interest per month; money lent; chit funds (asset before taken, owed after)
- R9 Recording payments per debt: Ask me (default, Paid / Not paid confirmation card on Overview and Wealth), Add automatically, or Don't add. Payments before the debt was added are treated as paid and never back-filled into expenses. Card bill payments and money received back are never counted as expense or income
- R11 Net worth on the Wealth tab (investments + money lent + chit money paid in − everything owed), monthly snapshot for change vs last month
- Invest tab replaced by Wealth: Investments, Debts, Lent & chits
- R6 Spending donut on Overview: top 5 categories plus Everything else, tap a slice or legend row to see its amount and share, category colours match the rows below
