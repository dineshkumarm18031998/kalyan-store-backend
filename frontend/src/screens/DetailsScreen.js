import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../utils/AppContext';
import { rupee, fDate } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { getBookings } from '../utils/api';

export default function DetailsScreen({ navigation }) {
  const { t, bookings, setBookings } = useApp();
  const { theme: C } = useTheme();
  const s = useStyles(C);
  
  const [flt, setFlt] = useState('all');
  const [srch, setSrch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const r = await getBookings(); setBookings(r.data); } catch (e) {}
  }, []);

  useEffect(() => { const unsub = navigation.addListener('focus', load); return unsub; }, [navigation]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = useMemo(() => {
    let l = bookings.filter(b => !b.isDeleted);
    if (flt === 'active') l = l.filter(b => b.status === 'ACTIVE');
    if (flt === 'returned') l = l.filter(b => b.status === 'RETURNED');
    if (flt === 'closed') l = l.filter(b => b.status === 'CLOSED');
    if (srch) { const q = srch.toLowerCase(); l = l.filter(b => b.cName?.toLowerCase().includes(q) || b.cMob?.includes(q)); }
    return l;
  }, [bookings, flt, srch]);

  const getStatus = (b) => {
    if (b.status === 'CLOSED') return { txt: 'CLOSED & SETTLED', bg: '#E8F5E9', c: '#2E7D32' };
    if (b.status === 'RETURNED') return { txt: 'RETURNED - UNPAID', bg: '#FFEBEE', c: '#C62828' };
    return { txt: 'ACTIVE', bg: '#E3F2FD', c: '#1565C0' };
  };

  return (
    <View style={s.wrap}>
      <View style={s.header}><Text style={s.hTitle}>{t.orderDet}</Text></View>
      <ScrollView style={s.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}>
        <View style={s.filterCard}>
          <View style={s.searchRow}><Ionicons name="search" size={16} color={C.textMuted} /><TextInput style={s.searchInput} placeholder={t.search} value={srch} onChangeText={setSrch} placeholderTextColor={C.textMuted} /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {[['all', t.all], ['active', 'Active'], ['returned', 'Returned'], ['closed', 'Closed']].map(([k, l]) => (
              <TouchableOpacity key={k} style={[s.chip, flt === k && s.chipOn]} onPress={() => setFlt(k)}><Text style={[s.chipTxt, flt === k && s.chipTxtOn]}>{l}</Text></TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <Text style={s.count}>{filtered.length} {t.orders}</Text>

        {filtered.map(b => {
          const st = getStatus(b);
          const isClosed = b.status === 'CLOSED';
          const cardBg = isClosed ? '#F1F8E9' : '#FFEBEE';
          const cardBorder = isClosed ? '#AED581' : '#EF9A9A';
          
          return (
            <TouchableOpacity key={b.id} style={[s.orderCard, { backgroundColor: cardBg, borderColor: cardBorder }]} onPress={() => navigation.navigate('OrderDetail', { bookingId: b.id })} activeOpacity={0.7}>
              <View style={s.ocTop}>
                <View style={[s.ocAv, { backgroundColor: isClosed ? '#81C784' : '#E57373' }]}><Text style={s.ocAvTxt}>{b.cName?.[0]?.toUpperCase()}</Text></View>
                <View style={s.ocInfo}>
                  <Text style={s.ocName}>{b.cName}</Text>
                  <Text style={s.ocPhone}><Ionicons name="call-outline" size={9} /> {b.cMob}</Text>
                  <Text style={s.ocItems}>{(b.items || []).map(x => `${x.name}×${x.qty}`).join(', ')}</Text>
                </View>
                <View style={s.ocRight}>
                  <Text style={s.ocAmt}>{b.totalAmount > 0 ? rupee(b.totalAmount) : `${rupee((b.items || []).reduce((ss, i) => ss + i.qty * i.rate, 0))}${t.perDay}`}</Text>
                  <View style={[s.statusBadge, { backgroundColor: st.bg }]}><Text style={[s.statusTxt, { color: st.c }]}>{st.txt}</Text></View>
                </View>
              </View>
              <View style={s.ocBot}>
                <Text style={s.ocDate}><Ionicons name="calendar-outline" size={10} /> {fDate(b.startDate)}{b.returnDate ? ` → ${fDate(b.returnDate)}` : ''}</Text>
                {b.totalDays > 0 && <View style={s.dayBadge}><Text style={s.dayTxt}>{b.totalDays}D</Text></View>}
              </View>
            </TouchableOpacity>
          );
        })}

        {filtered.length === 0 && <View style={s.empty}><Text style={{ fontSize: 36 }}>📋</Text><Text style={s.empTxt}>{t.noBk}</Text></View>}
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
  filterCard: { backgroundColor: C.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.inputBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 13, color: C.text },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, marginRight: 4, backgroundColor: C.card },
  chipOn: { borderColor: C.primary, backgroundColor: C.primary + '15' },
  chipTxt: { fontSize: 11, fontWeight: '600', color: C.textMuted },
  chipTxtOn: { color: C.primary },
  count: { fontSize: 10, color: C.textMuted, fontWeight: '600', marginVertical: 4 },
  orderCard: { backgroundColor: C.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: C.border, marginBottom: 6 },
  ocTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ocAv: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  ocAvTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  ocInfo: { flex: 1 },
  ocName: { fontWeight: '700', fontSize: 13, color: C.text },
  ocPhone: { fontSize: 9, color: C.textMuted },
  ocItems: { fontSize: 9, color: C.textMuted },
  ocRight: { alignItems: 'flex-end' },
  ocAmt: { fontWeight: '800', fontSize: 14, color: C.primary },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  statusTxt: { fontSize: 8, fontWeight: '700' },
  ocBot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.border },
  ocDate: { fontSize: 9, color: C.textMuted },
  dayBadge: { backgroundColor: C.primary + '15', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  dayTxt: { fontSize: 9, fontWeight: '700', color: C.primary },
  empty: { alignItems: 'center', padding: 30, marginTop: 20 },
  empTxt: { fontSize: 14, fontWeight: '700', color: C.textMuted, marginTop: 4 },
});
