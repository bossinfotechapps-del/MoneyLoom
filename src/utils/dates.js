export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const pad = (n) => String(n).padStart(2, '0');

// Local date as YYYY-MM-DD (never use toISOString: it shifts IST dates to the previous day)
export const strFromDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => strFromDate(new Date());
export const dateFromStr = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const monthKey = (s) => s.slice(0, 7);
export const currentMonth = () => monthKey(todayStr());

export const addMonths = (key, n) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
};

export const shortMonthName = (key) => MONTHS[Number(key.slice(5, 7)) - 1];

// Axis label: "Sep", but "Jan '26" at a year boundary
// Compact chart label for a month: "Apr-26"
export const axisMonthShort = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]}-${String(y).slice(2)}`;
};

// Compact chart label for a week, by its start date: "7-Sep", or "7-Sep-26" where there is room
export const axisWeekStart = (weekKey, withYear = false) => {
  const [y, m, d] = weekKey.split('-').map(Number);
  return `${d}-${MONTHS[m - 1]}${withYear ? `-${String(y).slice(2)}` : ''}`;
};

export const axisMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `Jan '${String(y).slice(2)}` : MONTHS[m - 1];
};

export const daysInMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

export const fmtDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

// Accepts YYYY-MM-DD or DD-MM-YYYY (also with / or .). Returns YYYY-MM-DD or null.
export const parseFlexibleDate = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return validYmd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return validYmd(+m[3], +m[2], +m[1]);
  return null;
};

const validYmd = (y, mo, d) => {
  if (mo < 1 || mo > 12 || d < 1) return null;
  if (d > new Date(y, mo, 0).getDate()) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
};

// Same day-of-month n months later (clamped to month end), e.g. 31 Jan + 1 → 28/29 Feb
export const addMonthsDate = (dateStr, n, dayOfMonth) => {
  const day = dayOfMonth || Number(dateStr.slice(8, 10));
  const k = addMonths(monthKey(dateStr), n);
  return `${k}-${pad(Math.min(day, daysInMonth(k)))}`;
};

export const daysBetween = (a, b) => Math.round((dateFromStr(b) - dateFromStr(a)) / 86400000);

// Whole months from a to b (by calendar month, ignoring days)
export const monthsBetween = (a, b) => {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
};

// Monthly dates starting at firstDate, up to `until` (inclusive), at most `count`
export const monthlyDates = (firstDate, until, count = 1200) => {
  const day = Number(firstDate.slice(8, 10));
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = addMonthsDate(firstDate, i, day);
    if (d > until) break;
    out.push({ key: monthKey(d), date: d, index: i });
  }
  return out;
};

export const monthYear = (dateStr) => `${MONTHS[Number(dateStr.slice(5, 7)) - 1]} ${dateStr.slice(0, 4)}`;

// ---------------- Weeks (Monday to Sunday) ----------------

// Monday of the week containing this date, as YYYY-MM-DD. Weeks are keyed by their Monday.
export const weekStart = (dateStr) => {
  const d = dateFromStr(dateStr);
  const shift = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - shift);
  return strFromDate(d);
};

export const currentWeek = () => weekStart(todayStr());

export const addWeeks = (weekKey, n) => {
  const d = dateFromStr(weekKey);
  d.setDate(d.getDate() + n * 7);
  return strFromDate(d);
};

export const weekEnd = (weekKey) => {
  const d = dateFromStr(weekKey);
  d.setDate(d.getDate() + 6);
  return strFromDate(d);
};

// "15 – 21 Sep" or "29 Sep – 5 Oct", with the year added when it isn't this year
export const weekLabel = (weekKey) => {
  const end = weekEnd(weekKey);
  const [, sm, sd] = weekKey.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const thisYear = Number(todayStr().slice(0, 4));
  const tail = ey === thisYear ? '' : ` ${ey}`;
  if (sm === em) return `${sd} – ${ed} ${MONTHS[em - 1]}${tail}`;
  return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]}${tail}`;
};

// Short axis label for a week: "15 Sep", or just "15" when space is tight
export const axisWeek = (weekKey, terse = false) => {
  const [, m, d] = weekKey.split('-').map(Number);
  return terse ? String(d) : `${d} ${MONTHS[m - 1]}`;
};

/**
 * Chart axes only have room for so many labels. This blanks out the ones that would collide,
 * keeping an even spread and always keeping the last (most recent) one.
 * Returns the labels in the same order, with hidden ones as ''.
 */
export const thinLabels = (labels, slotWidth, fontSize = 10) => {
  const widest = labels.reduce((max, l) => Math.max(max, l.length), 0) * fontSize * 0.62;
  const step = Math.max(1, Math.ceil((widest + 4) / Math.max(slotWidth, 1)));
  if (step === 1) return labels;
  const last = labels.length - 1;
  return labels.map((l, i) => ((last - i) % step === 0 ? l : ''));
};

export const isInWeek = (dateStr, weekKey) => dateStr >= weekKey && dateStr <= weekEnd(weekKey);

// A monthly budget spread over a week, and the reverse. 52 weeks in a year, 12 months.
const WEEKS_PER_MONTH = 52 / 12;
export const monthlyToWeekly = (amount) => Math.round(amount / WEEKS_PER_MONTH);
export const weeklyToMonthly = (amount) => Math.round(amount * WEEKS_PER_MONTH);

// ---------------- Indian financial year: 1 April to 31 March ----------------

// "2026-04" for any date in FY 2026-27
export const fyStart = (dateStr) => {
  const [y, m] = dateStr.split('-').map(Number);
  return `${m >= 4 ? y : y - 1}-04`;
};

export const currentFY = () => fyStart(todayStr());

export const addFY = (fyKey, n) => {
  const y = Number(fyKey.slice(0, 4)) + n;
  return `${y}-04`;
};

// Last day of the FY: 31 March of the following year
export const fyEnd = (fyKey) => `${Number(fyKey.slice(0, 4)) + 1}-03-31`;
export const fyFirstDay = (fyKey) => `${fyKey}-01`;

// "FY 2026-27"
export const fyLabel = (fyKey) => {
  const y = Number(fyKey.slice(0, 4));
  return `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`;
};

// Short axis label for a month inside an FY chart: "Apr", and "Jan '27" at the year change
export const fyMonths = (fyKey) => Array.from({ length: 12 }, (_, i) => addMonths(`${fyKey}`, i));

export const isInFY = (dateStr, fyKey) => dateStr >= fyFirstDay(fyKey) && dateStr <= fyEnd(fyKey);
