import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../utils/AppContext';
import { rupee, fDateLong, todayISO } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { getGreetKey } from '../utils/lang';
import { getProducts, getBookings } from '../utils/api';

export default function HomeScreen({ navigation }) {
  const { store, t, products, setProducts, bookings, setBookings, logout } = useApp();
  const { theme: C } = useTheme();
  const s = useStyles(C);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = useCallback(async () => {
    try {
      const [pRes, bRes] = await Promise.all([getProducts(), getBookings()]);
      setProducts(pRes.data);
      setBookings(bRes.data);
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }, []);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout }
      ]
    );
  };

  const d = todayISO();
  const todayRev = bookings.filter(b => b.date === d && b.paid).reduce((s, b) => s + b.totalAmount, 0);
  const totalRev = bookings.filter(b => b.paid).reduce((s, b) => s + b.totalAmount, 0);
  const pending = bookings.filter(b => !b.paid).reduce((s, b) => s + (b.totalAmount - (b.paidAmount || 0)), 0);
  const dmgCol = bookings.reduce((s, b) => (b.damages || []).reduce((ss, x) => ss + x.qty * x.rate, s), 0);

  const getRented = (name) => bookings.filter(b => !b.returned).reduce((s, b) => {
    const it = (b.items || []).find(i => i.name === name);
    return s + (it ? it.qty : 0);
  }, 0);

  const active = bookings.filter(b => !b.returned);

  const stats = [
    { l: t.todayCol, v: rupee(todayRev), c: C.teal, bg: C.tealLight, ic: '💰', f: 'today' },
    { l: t.totalRev, v: rupee(totalRev), c: C.blue, bg: C.blueLight, ic: '📊', f: 'all' },
    { l: t.pending, v: rupee(pending), c: C.red, bg: C.redLight, ic: '⏳', f: 'pending' },
    { l: t.dmgCol, v: rupee(dmgCol), c: C.orange, bg: C.orangeLight, ic: '⚠️', f: 'damage' },
  ];

  return (
    <View style={s.wrap}>
      {/* Header with logout */}
      <View style={s.header}>
        <View style={s.hLeft}>
          <Image source={require('../../assets/icon.png')} style={s.hLogo} />
          <View>
            <Text style={s.hStore}>{store?.storeName || 'Kalyan Store'}</Text>
            <Text style={s.hOwner}>{store?.ownerName || ''}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={s.logoutBtn}>
            <Ionicons name="settings-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}>
        <Text style={s.greet}>{t[getGreetKey()]}, {store?.ownerName?.split(' ')[0] || ''}! 🙏</Text>
        <Text style={s.date}>{fDateLong(d)}</Text>

        {/* Stats Grid */}
        <View style={s.statsGrid}>
          {stats.map((st, i) => (
            <TouchableOpacity key={i} style={[s.stat, { backgroundColor: st.bg }]} onPress={() => navigation.navigate('History', { filter: st.f })}>
              <Text style={{ fontSize: 16 }}>{st.ic}</Text>
              <Text style={[s.statVal, { color: st.c }]}>{st.v}</Text>
              <Text style={s.statLbl}>{st.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stock Overview */}
        {products.length > 0 && (
          <View style={s.section}>
            <Text style={s.secTitle}>📦 {t.stock}</Text>
            <View style={s.stockGrid}>
              {products.map(p => {
                const r = getRented(p.name), a = p.totalQty - r;
                const pct = p.totalQty > 0 ? (a / p.totalQty) * 100 : 0;
                const bc = pct > 50 ? C.teal : pct > 20 ? C.yellow : C.red;
                return (
                  <View key={p.id} style={s.stockCard}>
                    <View style={s.stockImg}>
                      {p.image ? <Image source={{ uri: p.image }} style={s.stockImgI} /> : <Ionicons name="cube-outline" size={28} color="#ccc" />}
                    </View>
                    <Text style={s.stockName}>{p.name}</Text>
                    <View style={s.stockBar}><View style={[s.stockFill, { width: `${pct}%`, backgroundColor: bc }]} /></View>
                    <Text style={s.stockNums}><Text style={[s.stockFree, { color: bc }]}>{a}</Text> / {p.totalQty}</Text>
                    <Text style={s.stockRate}>{rupee(p.rentPerDay)}{t.perDay}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Active Rentals */}
        {active.length > 0 && (
          <View style={s.section}>
            <Text style={s.secTitle}>🔥 {t.activeRent} ({active.length})</Text>
            {active.slice(0, 5).map(b => (
              <TouchableOpacity key={b.id} style={s.miniCard} onPress={() => navigation.navigate('Details')}>
                <View style={s.mcAv}><Text style={s.mcAvTxt}>{b.cName?.[0]?.toUpperCase()}</Text></View>
                <View style={s.mcInfo}>
                  <Text style={s.mcName}>{b.cName}</Text>
                  <Text style={s.mcItems}>{(b.items || []).map(x => `${x.name}×${x.qty}`).join(', ')}</Text>
                </View>
                <View style={s.mcRight}>
                  {b.totalAmount > 0 && <Text style={s.mcAmt}>{rupee(b.totalAmount)}</Text>}
                  <View style={[s.badge, b.paid ? s.badgePaid : s.badgeUnpaid]}>
                    <Text style={[s.badgeTxt, { color: b.paid ? C.green : C.red }]}>{b.paid ? t.paid : t.unpaid}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating New Order Button */}
      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('Order')}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const useStyles = (C) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.primary, paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hLogo: { width: 36, height: 36, borderRadius: 10 },
  hStore: { color: '#fff', fontSize: 16, fontWeight: '800' },
  hOwner: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  logoutBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)' },
  body: { flex: 1, padding: 12 },
  greet: { fontSize: 18, fontWeight: '800', color: C.text },
  date: { fontSize: 11, color: C.textMuted, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  stat: { width: '48%', borderRadius: 14, padding: 12, overflow: 'hidden' },
  statVal: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  statLbl: { fontSize: 9, fontWeight: '700', color: '#555', marginTop: 1 },
  section: { marginTop: 10, marginBottom: 6 },
  secTitle: { fontSize: 13, fontWeight: '800', marginBottom: 8, color: C.text },
  stockGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stockCard: { width: '47%', backgroundColor: C.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  stockImg: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' },
  stockImgI: { width: 50, height: 50, borderRadius: 12 },
  stockName: { fontSize: 14, fontWeight: '800', marginBottom: 4, color: C.text },
  stockBar: { width: '100%', height: 7, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden', marginBottom: 3 },
  stockFill: { height: '100%', borderRadius: 4 },
  stockNums: { fontSize: 12, fontWeight: '700', color: C.textMuted },
  stockFree: { fontSize: 15, fontWeight: '900' },
  stockRate: { fontSize: 11, fontWeight: '700', color: C.primary, marginTop: 2 },
  miniCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: C.border, marginBottom: 4, gap: 8 },
  mcAv: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  mcAvTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  mcInfo: { flex: 1 },
  mcName: { fontWeight: '700', fontSize: 12, color: C.text },
  mcItems: { fontSize: 9, color: C.textMuted },
  mcRight: { alignItems: 'flex-end' },
  mcAmt: { fontWeight: '800', fontSize: 13, color: C.primary },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  badgePaid: { backgroundColor: C.greenLight },
  badgeUnpaid: { backgroundColor: C.redLight },
  badgeTxt: { fontSize: 8, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, backgroundColor: C.primary, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
});
