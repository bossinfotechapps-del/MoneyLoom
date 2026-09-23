// Colour tokens and shared text styles for MoneyLoom
export const C = {
  paper: '#F4F8F6',
  surface: '#FFFFFF',
  ink: '#1E2A2B',
  inkSoft: '#354642',
  muted: '#66736F',
  line: '#DAE6E0',
  lineSoft: '#EBF2EE',
  chip: '#E8F0EC',
  spend: '#A63A5B',
  invest: '#1D6B66',
  investDark: '#175A56',
  earn: '#3B5B9A',
  gain: '#2E7D4F',
  loss: '#B23B3B',
  warn: '#B07A1E',
  white: '#FFFFFF',
};

// Used for allocation donut slices
export const PALETTE = ['#1D6B66', '#3B5B9A', '#C08A2E', '#A63A5B', '#6A5A9E', '#4E8A7B', '#8A6A55', '#7A8580'];

// One fixed colour per expense category so the donut, legend and rows always match
export const CATEGORY_COLORS = {
  'Groceries & food': '#1D6B66',
  'Eating out': '#C08A2E',
  'Rent & housing': '#3B5B9A',
  'EMI & loans': '#6A5A9E',
  'Bills & utilities': '#4E8A7B',
  'Fuel & transport': '#A63A5B',
  Health: '#2E7D9A',
  Shopping: '#C0667A',
  'Family & gifts': '#8A6A55',
  Subscriptions: '#5E7FB8',
  Education: '#7A9A3A',
  Entertainment: '#B55A3C',
  Other: '#7A8580',
};
export const OTHER_SLICE_COLOR = '#A9B4B0';

// Categories imported from CSV that aren't in the list get a stable colour from the palette
export const categoryColor = (name) => {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 1000003;
  return PALETTE[h % PALETTE.length];
};

// Faded version of a colour for non-selected chart bars (hex + alpha)
export const faded = (hex) => `${hex}59`;

export const T = {
  num: { fontVariant: ['tabular-nums'] },
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.85, color: C.ink },
  h2: { fontSize: 18, fontWeight: '800', letterSpacing: -0.45, color: C.ink },
  h3: { fontSize: 14, fontWeight: '700', color: C.ink },
  body: { fontSize: 15, color: C.ink },
  small: { fontSize: 13, lineHeight: 19, color: C.muted },
  label: { fontSize: 13, fontWeight: '600', color: C.inkSoft },
};
