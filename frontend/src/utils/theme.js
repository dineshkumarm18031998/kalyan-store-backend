export const C = {
  primary: '#D84315',
  primaryDark: '#BF360C',
  primaryLight: '#FF6E40',
  green: '#2E7D32',
  greenLight: '#E8F5E9',
  red: '#C62828',
  redLight: '#FFEBEE',
  blue: '#1565C0',
  blueLight: '#E3F2FD',
  orange: '#E65100',
  orangeLight: '#FFF3E0',
  yellow: '#F9A825',
  teal: '#00897B',
  tealLight: '#E0F2F1',
  whatsapp: '#25D366',
  bg: '#F8F4EF',
  card: '#FFFFFF',
  border: '#EDE7E0',
  text: '#1A1A2E',
  textMuted: '#8D6E63',
  inputBg: '#FAFAF7',
};

export const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export const fDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export const fDateLong = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '';

export const todayISO = () => new Date().toISOString().split('T')[0];

export const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  const d = Math.ceil((new Date(b) - new Date(a)) / 86400000);
  return d < 1 ? 1 : d;
};
