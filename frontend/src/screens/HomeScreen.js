import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Image, Alert, Dimensions, FlatList } from 'react-native';

const { width } = Dimensions.get('window');
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
  const [selCat, setSelCat] = React.useState('All');

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
  const validBookings = bookings.filter(b => !b.isDeleted);
  
  // 1. Active Orders
  const activeCount = validBookings.filter(b => b.status === 'ACTIVE').length;
  
  // 2. Available Stock
  const totalInv = products.reduce((s, p) => s + p.totalQty, 0);
  const activeRented = validBookings.filter(b => b.status === 'ACTIVE').reduce((s, b) => s + (b.items || []).reduce((ss, i) => ss + i.qty, 0), 0);
  const availStock = totalInv - activeRented;

  // 3. Pending Settlement
  const pendingCount = validBookings.filter(b => b.status === 'RETURNED').length;
  
  // Today Revenue
  const todayDate = new Date().toISOString().split('T')[0];
  const todayRev = validBookings
    .filter(b => b.status === 'CLOSED' && b.updatedAt && b.updatedAt.startsWith(todayDate))
    .reduce((s, b) => s + (b.totalAmount || 0), 0);

  // Damaged Revenue
  const dmgRev = validBookings
    .filter(b => b.status === 'CLOSED')
    .reduce((s, b) => s + (b.damages || []).reduce((ss, d) => ss + (d.qty * d.rate), 0), 0);

  const getRented = (name) => validBookings.filter(b => b.status === 'ACTIVE').reduce((s, b) => {
    const it = (b.items || []).find(i => i.name === name);
    return s + (it ? it.qty : 0);
  }, 0);

  const active = validBookings.filter(b => b.status === 'ACTIVE');

  const stats = [
    { l: t.todayCol, v: rupee(todayRev), c: '#00E676', bg: '#E8F5E9', ic: '💸', f: 'month' },
    { l: t.activeOrd, v: activeCount, c: '#0288D1', bg: '#E1F5FE', ic: '📦', f: 'active' },
    { l: t.availStock, v: availStock, c: '#E65100', bg: '#FFF3E0', ic: '✅', f: 'stock' },
    { l: t.pending, v: pendingCount, c: '#C62828', bg: '#FFEBEE', ic: '⏳', f: 'returned' },
    { l: t.dmgRev, v: rupee(dmgRev), c: '#8E24AA', bg: '#F3E5F5', ic: '⚠️', f: 'closed' },
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

        <View style={s.heroCard}>
          <Text style={s.heroSubtitle}>{t.totalRev.toUpperCase()}</Text>
          <Text style={s.heroTitle}>{rupee(totalRev)}</Text>
        </View>

        {/* 3D Stats Grid */}
        <View style={s.statsGrid}>
          {stats.map((st, i) => (
            <TouchableOpacity key={i} style={[s.stat3D, { borderLeftColor: st.c }]} onPress={() => navigation.navigate('History', { filter: st.f })} activeOpacity={0.8}>
              <View style={[s.statIconWrap, { backgroundColor: st.bg }]}>
                <Text style={{ fontSize: 22 }}>{st.ic}</Text>
              </View>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={[s.statVal, { color: st.c }]}>{st.v}</Text>
                <Text style={s.statLbl}>{st.l}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stock Overview */}
        {products.length > 0 && (() => {
          const cats = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
          const filtered = selCat === 'All' ? products : products.filter(p => p.category === selCat);
          return (
            <View style={s.section}>
              <Text style={s.secTitle}>📦 {t.stock}</Text>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {cats.map(c => (
                  <TouchableOpacity 
                    key={c} 
                    style={[s.catPill, selCat === c && s.catPillOn]} 
                    onPress={() => setSelCat(c)}
                  >
                    <Text style={[s.catTxt, selCat === c && s.catTxtOn]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <FlatList
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={Array.from({ length: Math.ceil(filtered.length / 4) }, (v, i) => filtered.slice(i * 4, i * 4 + 4))}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => (
                  <View style={{ width: width - 24, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {item.map(p => {
                      const r = getRented(p.name), a = p.totalQty - r;
                      const pct = p.totalQty > 0 ? (a / p.totalQty) * 100 : 0;
                      const bc = pct > 50 ? C.teal : pct > 20 ? C.yellow : C.red;
                      return (
                        <View key={p.id} style={s.stockCard}>
                          <View style={s.stockImg}>
                            {p.image ? <Image source={{ uri: p.image }} style={s.stockImgI} /> : <Ionicons name="cube-outline" size={28} color="#ccc" />}
                          </View>
                          <Text style={s.stockName} numberOfLines={1}>{p.name}</Text>
                          <View style={s.stockBar}><View style={[s.stockFill, { width: `${pct}%`, backgroundColor: bc }]} /></View>
                          <Text style={s.stockNums}><Text style={[s.stockFree, { color: bc }]}>{a}</Text> / {p.totalQty}</Text>
                          <Text style={s.stockRate}>{rupee(p.rentPerDay)}{t.perDay}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              />
            </View>
          );
        })()}

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
  greet: { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  date: { fontSize: 13, color: C.textMuted, marginBottom: 16, fontWeight: '600' },
  
  heroCard: { 
    backgroundColor: '#1E1E2C', 
    borderRadius: 20, 
    padding: 24, 
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  heroSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  heroTitle: { color: '#00E676', fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  heroFooter: { marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  heroFooterTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  stat3D: { 
    width: '47%', 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
    borderLeftWidth: 5,
  },
  statIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 22, fontWeight: '900' },
  statLbl: { fontSize: 10, fontWeight: '800', color: '#777', marginTop: 2, textTransform: 'uppercase' },
  
  section: { marginTop: 10, marginBottom: 12 },
  secTitle: { fontSize: 15, fontWeight: '900', marginBottom: 12, color: C.text, letterSpacing: -0.3 },
  catPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f5', marginRight: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  catPillOn: { backgroundColor: '#1E1E2C', borderColor: '#1E1E2C' },
  catTxt: { fontSize: 13, fontWeight: '800', color: '#666' },
  catTxtOn: { color: '#fff' },
  stockGrid: { flexDirection: 'row', gap: 12 },
  stockCard: { 
    width: '47%', 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 12, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
    marginBottom: 12,
  },
  stockImg: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#f8f9fa', alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
  stockImgI: { width: 60, height: 60, borderRadius: 16 },
  stockName: { fontSize: 14, fontWeight: '900', marginBottom: 6, color: C.text },
  stockBar: { width: '100%', height: 8, backgroundColor: '#f0f0f5', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  stockFill: { height: '100%', borderRadius: 4 },
  stockNums: { fontSize: 12, fontWeight: '800', color: '#888' },
  stockFree: { fontSize: 16, fontWeight: '900' },
  stockRate: { fontSize: 11, fontWeight: '800', color: C.primary, marginTop: 4, backgroundColor: C.primary+'15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  
  miniCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 12, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 8, 
    gap: 12,
    marginHorizontal: 4
  },
  mcAv: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E1E2C', alignItems: 'center', justifyContent: 'center' },
  mcAvTxt: { color: '#fff', fontWeight: '900', fontSize: 16 },
  mcInfo: { flex: 1 },
  mcName: { fontWeight: '800', fontSize: 14, color: C.text, marginBottom: 2 },
  mcItems: { fontSize: 11, color: '#777', fontWeight: '600' },
  mcRight: { alignItems: 'flex-end' },
  mcAmt: { fontWeight: '900', fontSize: 15, color: '#1E1E2C', marginBottom: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgePaid: { backgroundColor: '#E8F5E9' },
  badgeUnpaid: { backgroundColor: '#FFEBEE' },
  badgeTxt: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  
  fab: { 
    position: 'absolute', 
    bottom: 30, right: 20, 
    width: 64, height: 64, 
    backgroundColor: '#00E676', 
    borderRadius: 32, 
    alignItems: 'center', 
    justifyContent: 'center', 
    elevation: 12, 
    shadowColor: '#00E676', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.4, 
    shadowRadius: 12 
  },
});
