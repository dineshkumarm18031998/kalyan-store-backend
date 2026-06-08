import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useApp } from '../utils/AppContext';
import { rupee, fDate } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';

const MNF = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function HistoryScreen({ route }) {
  const { t, store, bookings } = useApp();
  const { theme: C } = useTheme();
  const s = useStyles(C);

  const [srch, setSrch] = useState('');
  const [typeFilter, setTypeFilter] = useState(route?.params?.filter || 'all');
  
  React.useEffect(() => {
    if (route?.params?.filter) setTypeFilter(route.params.filter);
  }, [route?.params?.filter]);
  const [vw, setVw] = useState('month');
  const [mo, setMo] = useState(new Date().getMonth());
  const [yr, setYr] = useState(new Date().getFullYear());

  const filtered = useMemo(() => {
    let l = bookings;
    
    if (typeFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      l = l.filter(b => b.date === today);
    } else {
      if (vw === 'month') l = l.filter(b => { const d = new Date(b.date); return d.getMonth() === mo && d.getFullYear() === yr; });
      else l = l.filter(b => new Date(b.date).getFullYear() === yr);
    }

    if (typeFilter === 'pending') l = l.filter(b => !b.paid && !b.isDeleted);
    if (typeFilter === 'damage') l = l.filter(b => (b.damages || []).length > 0 && !b.isDeleted);

    if (srch) { const s2 = srch.toLowerCase(); l = l.filter(b => b.cName?.toLowerCase().includes(s2) || b.cMob?.includes(s2)); }
    return l;
  }, [bookings, vw, mo, yr, srch, typeFilter]);

  const pd = filtered.filter(b => b.paid && !b.isDeleted).reduce((s2, b) => s2 + b.totalAmount, 0);
  const pn = filtered.filter(b => !b.paid && !b.isDeleted).reduce((s2, b) => s2 + (b.totalAmount - (b.paidAmount || 0)), 0);
  const tt = filtered.filter(b => !b.isDeleted).reduce((s2, b) => s2 + b.totalAmount, 0);

  const prev = () => { if (vw === 'month') { if (mo === 0) { setMo(11); setYr(y => y - 1); } else setMo(m => m - 1); } else setYr(y => y - 1); };
  const next = () => { if (vw === 'month') { if (mo === 11) { setMo(0); setYr(y => y + 1); } else setMo(m => m + 1); } else setYr(y => y + 1); };

  const expWA = () => {
    const p = vw === 'month' ? `${MNF[mo]} ${yr}` : yr;
    let tx = `📊 *${store.storeName}*\n_${p}_\n\n✅ Paid: ${rupee(pd)}\n⏳ Pending: ${rupee(pn)}\n💰 Total: ${rupee(tt)}\n\n`;
    filtered.filter(b => !b.isDeleted).forEach((b, i) => { tx += `${i + 1}. ${b.cName} — ${rupee(b.totalAmount)} ${b.paid ? '✅' : '⏳'}\n`; });
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(tx)}`);
  };

  const expPDF = async () => {
    const p = vw === 'month' ? `${MNF[mo]} ${yr}` : yr;
    const html = `<html><head><meta name="viewport" content="width=device-width"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;max-width:700px;margin:auto;padding:20px}h1{font-size:20px;color:${C.primary}}h2{font-size:13px;color:#888;margin:3px 0 14px}table{width:100%;border-collapse:collapse}th{background:#FBE9E7;color:${C.primary};font-size:9px;padding:6px;text-align:left}td{padding:6px;font-size:11px;border-bottom:1px solid #f5f5f5}.p{color:#2E7D32}.u{color:#C62828}</style></head><body><h1>${store.storeName}</h1><h2>${p}</h2><table><thead><tr><th>#</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th></tr></thead><tbody>${filtered.filter(b => !b.isDeleted).map((b, i) => `<tr><td>${i + 1}</td><td>${b.cName}</td><td>${(b.items || []).map(x => `${x.name}×${x.qty}`).join(', ')}</td><td>${rupee(b.totalAmount)}</td><td class="${b.paid ? 'p' : 'u'}">${b.paid ? 'Paid' : 'Unpaid'}</td></tr>`).join('')}</tbody></table></body></html>`;
    try { const { uri } = await Print.printToFileAsync({ html }); await Sharing.shareAsync(uri); } catch (e) {}
  };

  return (
    <View style={s.wrap}>
      <View style={s.header}><Text style={s.hTitle}>{t.hist}</Text></View>
      <ScrollView style={s.body}>
        <View style={s.card}>
          <View style={s.viewTog}>
            <TouchableOpacity style={[s.vtBtn, vw === 'month' && s.vtOn]} onPress={() => setVw('month')}><Text style={[s.vtTxt, vw === 'month' && s.vtTxtOn]}>{t.monthly}</Text></TouchableOpacity>
            <TouchableOpacity style={[s.vtBtn, vw === 'year' && s.vtOn]} onPress={() => setVw('year')}><Text style={[s.vtTxt, vw === 'year' && s.vtTxtOn]}>{t.yearly}</Text></TouchableOpacity>
          </View>
          <View style={s.periodNav}>
            <TouchableOpacity style={s.navArr} onPress={prev}><Ionicons name="chevron-back" size={16} color={C.primary} /></TouchableOpacity>
            <Text style={s.periodLabel}>{vw === 'month' ? `${MNF[mo]} ${yr}` : yr}</Text>
            <TouchableOpacity style={s.navArr} onPress={next}><Ionicons name="chevron-forward" size={16} color={C.primary} /></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'pending', label: 'Pending' },
              { id: 'damage', label: 'Damaged' }
            ].map(f => (
              <TouchableOpacity key={f.id} style={[s.filterChip, typeFilter === f.id && s.filterChipOn]} onPress={() => setTypeFilter(f.id)}>
                <Text style={[s.filterTxt, typeFilter === f.id && s.filterTxtOn]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={s.searchRow}><Ionicons name="search" size={14} color={C.textMuted} /><TextInput style={s.searchInput} placeholder={t.search} value={srch} onChangeText={setSrch} placeholderTextColor={C.textMuted} /></View>
        </View>

        <View style={s.sumBar}>
          <View style={s.sumItem}><Text style={[s.sumVal, { color: C.green }]}>{rupee(pd)}</Text><Text style={s.sumLbl}>{t.paid}</Text></View>
          <View style={s.sumDiv} />
          <View style={s.sumItem}><Text style={[s.sumVal, { color: C.red }]}>{rupee(pn)}</Text><Text style={s.sumLbl}>{t.unpaid}</Text></View>
          <View style={s.sumDiv} />
          <View style={s.sumItem}><Text style={[s.sumVal, { color: C.primary }]}>{rupee(tt)}</Text><Text style={s.sumLbl}>{t.total}</Text></View>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          <TouchableOpacity style={[s.expBtn, { backgroundColor: '#25D366' }]} onPress={expWA}><Ionicons name="logo-whatsapp" size={14} color="#fff" /><Text style={s.expTxt}>{t.expWA}</Text></TouchableOpacity>
          <TouchableOpacity style={[s.expBtn, { backgroundColor: C.blue }]} onPress={expPDF}><Ionicons name="download" size={14} color="#fff" /><Text style={s.expTxt}>{t.expPDF}</Text></TouchableOpacity>
        </View>

        <Text style={s.count}>{filtered.length} {t.bookings}</Text>

        {filtered.map(b => (
          <View key={b.id} style={[s.histCard, b.isDeleted && { opacity: 0.6 }]}>
            <View style={s.hcAv}><Text style={s.hcAvTxt}>{b.cName?.[0]?.toUpperCase()}</Text></View>
            <View style={s.hcInfo}>
              <Text style={[s.hcName, b.isDeleted && { textDecorationLine: 'line-through' }]}>{b.cName}</Text>
              <Text style={s.hcDate}>{fDate(b.date)} • {(b.items || []).map(x => `${x.name}×${x.qty}`).join(', ')}</Text>
            </View>
            <View style={s.hcRight}>
              <Text style={s.hcAmt}>{b.totalAmount > 0 ? rupee(b.totalAmount) : '—'}</Text>
              <View style={{flexDirection:'row', gap:4, marginTop: 4}}>
                {b.isDeleted && <View style={[s.badge, { backgroundColor: '#FFCDD2' }]}><Text style={[s.badgeTxt, { color: '#B71C1C' }]}>DELETED</Text></View>}
                <View style={[s.badge, b.paid ? s.badgePd : s.badgeUp]}><Text style={[s.badgeTxt, { color: b.paid ? C.green : C.red }]}>{b.paid ? t.paid : t.unpaid}</Text></View>
              </View>
            </View>
          </View>
        ))}

        {filtered.length === 0 && <View style={s.empty}><Text style={{ fontSize: 36 }}>📅</Text><Text style={s.empTxt}>{t.noBk}</Text></View>}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const useStyles = (C) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.primary, paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16 },
  hTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  body: { flex: 1, padding: 12 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  viewTog: { flexDirection: 'row', backgroundColor: C.inputBg, borderRadius: 8, padding: 2, marginBottom: 8 },
  vtBtn: { flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: 'center' },
  vtOn: { backgroundColor: C.primary },
  vtTxt: { fontSize: 12, fontWeight: '700', color: C.textMuted },
  vtTxtOn: { color: '#fff' },
  periodNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 },
  navArr: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  periodLabel: { fontSize: 15, fontWeight: '800', minWidth: 130, textAlign: 'center', color: C.text },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginRight: 6, backgroundColor: C.bg },
  filterChipOn: { borderColor: C.primary, backgroundColor: C.primary },
  filterTxt: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  filterTxtOn: { color: '#fff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.inputBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 12, color: C.text },
  sumBar: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8, alignItems: 'center' },
  sumItem: { flex: 1, alignItems: 'center' },
  sumVal: { fontSize: 14, fontWeight: '900' },
  sumLbl: { fontSize: 8, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase' },
  sumDiv: { width: 1, height: 22, backgroundColor: C.border },
  expBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 10, borderRadius: 10 },
  expTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  count: { fontSize: 10, color: C.textMuted, fontWeight: '600', marginBottom: 4 },
  histCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.border, marginBottom: 5 },
  hcAv: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.textMuted, alignItems: 'center', justifyContent: 'center' },
  hcAvTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  hcInfo: { flex: 1 },
  hcName: { fontWeight: '700', fontSize: 12, color: C.text },
  hcDate: { fontSize: 9, color: C.textMuted },
  hcRight: { alignItems: 'flex-end' },
  hcAmt: { fontWeight: '800', fontSize: 13, color: C.primary },
  badge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  badgePd: { backgroundColor: C.greenLight },
  badgeUp: { backgroundColor: C.redLight },
  badgeTxt: { fontSize: 8, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 30, marginTop: 20 },
  empTxt: { fontSize: 14, fontWeight: '700', color: C.textMuted, marginTop: 4 },
});
