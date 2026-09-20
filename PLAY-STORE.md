# MoneyLoom – Play Console checklist

## Store listing (drafts)

**App name (max 30):** MoneyLoom: Expense Tracker

**Short description (max 80):** Track expenses and investments with monthly trends. Your entries stay on phone.

**Full description:**

MoneyLoom is a simple money log for everyday spending and long-term saving.

Log an expense in a few taps: amount, category, how you paid. Add income and every SIP, PPF, NPS, FD, gold or stock contribution. MoneyLoom turns it into a clear monthly picture.

What you get:
• A 12-month chart of what you earned, spent and invested
• Monthly budgets per category, with how much is left
• Your own categories, added in seconds
• Optional Google sign-in with cloud backup, so nothing is lost when you change phones
• Monthly repeats: rent, EMI, salary and SIPs added automatically
• Spending by category compared with last month
• Investments: total invested, current value, gain
• Debts: home, vehicle, personal, education and gold loans, credit cards, pay later, hand loans
• Money lent to friends and family, and chit funds
• Bank and cash accounts, with balances you enter yourself
• Net worth: what you own minus what you owe, with EMI dates and debt-free dates
• A daily reminder to log your spending (optional)
• Search and filter every entry by month, category or type
• Import from CSV (Excel), export to CSV for Excel, Google Sheets or Power BI
• Backup and restore with one file

Free with ads. Remove ads with a one-time purchase.

Private by design: no bank connection, and no login unless you want one. Your entries stay on your phone. Sign in with Google only if you want a cloud backup.

MoneyLoom records the numbers you enter. It does not give investment, tax or financial advice.

**Category:** Finance  **Tags:** Budget, Expense tracker  **Contact email:** bossinfotech.apps@gmail.com
**Privacy policy URL:** your GitHub Pages link to `privacy-policy.html`

Keep the listing to "track / log / record". Avoid words like "returns", "profit", "trading tips" or "advice".

**Screenshots (phone, at least 2, ideally 4–8):** on a fresh install tap Load sample data and set two budgets, then capture Overview (top), Last 12 months chart, Where the money went with budgets, Add entry with Repeat every month, Investments. Icon and feature graphic are in `docs/`.


## 2026 policy checklist (checked 14 Sep 2026)

Do the slow, blocking items first: account verification and the closed test gate everything else.

### Account level

| Item | What applies to MoneyLoom |
|---|---|
| Account type | Play Console Requirements say developers providing **financial products and services** (banking, loans, stock trading, investment funds, crypto wallets and exchanges) must register as an **Organization**. MoneyLoom does none of those: it records numbers the user types and moves no money. A personal account is the reasonable reading, but the Financial Services policy defines the category broadly as "management or investment of money... including personalized advice", so keep the app firmly on the tracking side. See the risk note below |
| Identity verification | Personal accounts upload a government ID. Start this on day one: it blocks publishing |
| App registration | Android developer verification requires app package names to be registered in Play Console. Most are auto-registered; check the Play Console Home page and register `com.bossinfotech.moneyloom` if it isn't listed. Enforcement starts 30 Sep 2026 in Brazil, Indonesia, Singapore and Thailand, and expands globally in 2027 |
| Payments profile | Needed before you can sell the Remove ads product |

### Before production

| Item | Status for this app |
|---|---|
| Target API 36 (Android 16) | Done. Required for new apps and updates from 31 Aug 2026 |
| Closed test: 12 testers, opted in 14 continuous days | Required if your personal account was created after 13 Nov 2023. Per app, not per account. Google also checks the testers actually used the app, so ask them to open it daily and add a few entries |
| Financial features declaration | **Every** app must complete it, including apps only on closed testing. Declare no financial features: MoneyLoom doesn't lend, move money, trade or connect to banks |
| Data safety | See the section above. Declare the AdMob SDK data, plus name/email/user ID and the financial info in cloud backup once sign-in is live |
| Account deletion | In-app under More, plus the hosted `delete-account.html` URL. Required because the app creates accounts |
| App access | No login required, so no demo account needed. Say sign-in is optional and only enables cloud backup |
| Ads | Yes, contains ads |
| Content rating, target audience (18+), news (no), government (no), health (no) | Complete each in App content |

### Policies worth reading before you write the listing

- **Financial Services**: keep to "track", "log", "record". No returns, profit, advice or recommendations. The in-app line "MoneyLoom records the numbers you enter. It doesn't give investment, tax or financial advice" should stay, and the same sentence belongs in the store description
- **Contacts permissions policy** (new in 2026): MoneyLoom requests no contacts permission. Keep it that way
- **User Data / Permissions**: the app asks only for notifications. Nothing else is declared, which is a strong position for a finance app
- **Account transfer policy** (new in 2026): if the app ever moves to another account, use the official transfer process

### The one real risk

The organization-account rule for financial services is the item most likely to cause trouble. Reviewers look at what the app does, and a tracker that holds no money and offers no advice sits outside the listed categories. To keep it that way:

1. Never describe MoneyLoom as giving advice, recommendations or predictions.
2. Don't add features that touch real money: no bank connections, no account aggregation, no lending, no buying or selling of investments.
3. Keep the "not financial advice" line in the app and the listing.

If Google ever asks for an organization account, the path is a D-U-N-S number for Boss Infotech, which is free but can take up to 30 days. Worth knowing before you need it, not after.

## App content forms

| Form | Answer |
|---|---|
| Privacy policy | Hosted URL |
| Account deletion URL | Hosted `delete-account.html` URL. Required because the app lets people create an account |
| Ads | **Yes, my app contains ads** |
| In-app products | Remove ads one-time product (see SETUP.md). The listing shows "In-app purchases" automatically |
| App access | **All functionality is available without special access.** Sign-in is optional, so no test credentials are needed. If a reviewer asks, say the Google sign-in only enables cloud backup |
| Content rating | Complete questionnaire; utility/finance app, no user-generated sharing, no gambling |
| Target audience | 18 and over |
| News app | No |
| Data safety | See below |
| Financial features | Read the full list carefully. MoneyLoom doesn't lend, move money, hold funds, trade or connect to banks. Answer only what's true; if no listed feature applies, choose the "no financial features" option |
| Government app | No |
| Health | No |

## Data safety (because of AdMob)

Your own entries are not collected (they never leave the phone unless the user shares a backup file). The Remove ads purchase is processed by Google Play; the app only stores an "ads removed" flag on the phone. The daily reminder is a local notification and sends nothing anywhere. The Google Mobile Ads SDK does collect data, so declare what Google lists in its official "Google Mobile Ads SDK data disclosure" page. At the time of writing that includes:

- **Location:** approximate location
- **App info and performance:** crash logs, diagnostics, other performance data
- **Device or other IDs:** advertising ID and similar
- **App activity:** app interactions

Purposes: advertising or marketing, analytics, fraud prevention/security/compliance. Shared with Google: yes. Encrypted in transit: yes. Users can request deletion: yes (Delete all data in app; ad data via Google settings).

If you enable Google sign-in and cloud backup, also declare, all optional and only when the person signs in:

- **Personal info:** name, email address, user IDs — collected for account management and app functionality
- **Financial info:** "Other financial info" — the expenses, investments and debts the person entered, stored in their own cloud backup for app functionality

Both are collected (they leave the device), not shared with other companies, encrypted in transit, and deletable in the app under More > Delete account.

Check Google's page before submitting in case the list has changed.

## Testing and release

1. Upload the AAB to **Internal testing** first and install from Play on your own phone.
2. If your developer account is a personal account created after 13 Nov 2023, run a **Closed test with at least 12 testers opted in for 14 continuous days**, then apply for production access. Friends, colleagues and family on Android with Gmail accounts work; ask them to actually open and use the app.
3. Production: roll out to 20% first, watch crashes in Play Console > Quality, then go to 100%.

Target API: the project already targets Android 16 (API 36), which new apps and updates need from 31 Aug 2026.
