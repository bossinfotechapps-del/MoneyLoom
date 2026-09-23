MoneyLoom – app-wide UI polish and initial Month category-detail scroll fix
==========================================================================

Patch format
------------
Contains only changed files, with paths relative to the root of the MoneyLoom
project. No full project copy, local data, keystore, cloud configuration, or
Android build files are included.

Baseline
--------
Built by combining your latest uploaded "MoneyLoom-main - Updated one.zip"
with your previously confirmed working
"MoneyLoom_professional_UI_cashflow_update_changed_files.zip" and
"MoneyLoom_payment_confirmation_changed_files.zip". If you have made further
local changes since those updates, review this patch against your working tree
before replacing files.

Included
--------
- Consistent visual treatments for headings, cards, summary tiles, period
  selectors, buttons, lists, cash flow, investments, goals, and More settings.
- Preserves Week / Month / FY, charts, report values, existing forms and buttons,
  confirmation/payment allocation, income, investments, budget, dues and tabs.
- Category detail opens using a native vertical scroll view in Month and Week;
  its modal now sits beside, not inside, the Overview's scrolling view.
- Added a regression test for initial Month detail scroll configuration.

Install
-------
1. Back up/commit your current project and keep a copy of its working version.
2. Extract this ZIP directly into C:\Users\bossu\MoneyLoom; preserve folder
   paths and allow replacement of the included matching files only.
3. In CMD:
     cd /d C:\Users\bossu\MoneyLoom
     git diff --stat
     npm test -- --runInBand
     npm run android
4. On an Android phone, open Overview > a category (e.g., Subscriptions),
   leave Month selected, then swipe from the chart and from the lower list;
   verify the lower entries are reachable *before* switching to Week. Recheck
   Week, Month and FY overview, adding entries, confirmation, Cash Flow Plan,
   dues, budgets, Wealth, Goals and More.
5. If the first Month scroll still fails, share a screen recording and the
   Android model/version. A build/device gesture interaction needs direct
   reproduction to isolate further.

Validation
----------
Source parsing of all changed JS/JSX files passed; static checks verified that
initial Month uses native scrolling, the category sheet is outside the parent
scroll view, and existing overview trackers/navigation remain. The full Jest
suite and real Android gesture/UI tests could not be run in this environment.
