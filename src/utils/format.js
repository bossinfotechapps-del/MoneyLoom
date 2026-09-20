// Indian number grouping: 12,34,567
const groupIndian = (intStr) => {
  if (intStr.length <= 3) return intStr;
  const last3 = intStr.slice(-3);
  const rest = intStr.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
};

export const fmt = (n) => {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? '-' : '';
  return `${sign}₹${groupIndian(String(Math.abs(v)))}`;
};

// Signed amount with a real minus sign, e.g. +₹1,200 / −₹450
export const fmtSigned = (n) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;

export const compact = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${s}₹${Math.round(a / 1e3)}k`;
  return `${s}₹${Math.round(a)}`;
};

export const pct = (n, digits = 0) => `${(Number.isFinite(n) ? n : 0).toFixed(digits)}%`;

export const toNumber = (v) => Number(String(v ?? '').replace(/[₹,\s]/g, ''));

// Round a chart maximum up to a clean value so axis labels are readable
export const niceMax = (value) => {
  const v = Math.max(Number(value) || 0, 1000);
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (const s of steps) {
    if (s * magnitude >= v) return s * magnitude;
  }
  return 10 * magnitude;
};

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
