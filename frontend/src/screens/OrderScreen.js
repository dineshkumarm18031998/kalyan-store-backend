import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useApp } from '../utils/AppContext';
import { rupee, todayISO, fDateLong } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { EVENTS } from '../utils/lang';
import { createBooking, getProducts, getMembers } from '../utils/api';

export default function OrderScreen({ navigation }) {
  const { t, store, products, setProducts, bookings } = useApp();
  const { theme: C } = useTheme();
  const s = useStyles(C);
  
  const [cust, setCust] = useState({ name: '', mob: '', addr: '', notes: '', ev: 'wedding', paidAmount: '' });
  const [items, setItems] = useState([]);
  const [sd, setSd] = useState(todayISO());
  const [showPicker, setShowPicker] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [generatedBy, setGeneratedBy] = useState(store?.ownerName || '');
  const [members, setMembers] = useState([]);
  const [done, setDone] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selCat, setSelCat] = useState('All');
  const cu = (k, v) => setCust(p => ({ ...p, [k]: v }));

  useEffect(() => { 
    (async () => { 
      try { 
        const r = await getProducts(); setProducts(r.data); 
        const m = await getMembers(); setMembers(m.data);
      } catch (e) {} 
    })(); 
  }, []);

  const getRented = (name) => bookings.filter(b => b.status === 'ACTIVE' && !b.isDeleted).reduce((s, b) => {
    const it = (b.items || []).find(i => i.name === name); return s + (it ? it.qty : 0);
  }, 0);

  const tog = (p) => {
    const ex = items.find(i => i.pid === p.id);
    if (ex) setItems(items.filter(i => i.pid !== p.id));
    else setItems([...items, { pid: p.id, name: p.name, qty: 1, rate: p.rentPerDay, image: p.image }]);
  };

  const setQ = (pid, v) => {
    const p = products.find(x => x.id === pid);
    const a = p.totalQty - getRented(p.name);
    setItems(items.map(i => i.pid === pid ? { ...i, qty: Math.max(1, Math.min(a, v)) } : i));
  };

  const daily = items.reduce((s2, i) => s2 + i.qty * i.rate, 0);
  const ok = cust.name && cust.mob && items.length > 0;

  const create = async () => {
    if (!ok) return;
    setLoading(true);
    try {
      const res = await createBooking({
        cName: cust.name, cMob: cust.mob, cAddr: cust.addr, notes: cust.notes,
        eventType: cust.ev, startDate: sd, isVip, generatedBy, paidAmount: parseFloat(cust.paidAmount) || 0,
        items: items.map(i => ({ name: i.name, qty: i.qty, rate: i.rate, image: i.image }))
      });
      setDone(res.data);
    } catch (e) { Alert.alert('Error', 'Failed to create booking'); }
    setLoading(false);
  };

  const shareWA = () => {
    if (!done) return;
    const txt = `✅ *Booking Confirmed!*\n\n🏪 *${store.storeName}*\nDear ${done.cName},\n\n📦 Items:\n${(done.items || []).map(i => `  • ${i.name} × ${i.qty}`).join('\n')}\n\n📅 Start: ${fDateLong(done.startDate)}\n💰 ${rupee(daily)}/day\n\n🙏 Thank you!\n_${store.storeName}_`;
    Linking.openURL(`https://wa.me/${done.cMob?.replace(/\D/g, '')}?text=${encodeURIComponent(txt)}`);
  };

  if (done) return (
    <View style={s.wrap}>
      <View style={s.header}><Text style={s.hTitle}>{t.created}</Text></View>
      <ScrollView style={s.body}>
        <View style={s.succBox}><Text style={{ fontSize: 42 }}>🎉</Text><Text style={s.succTxt}>{t.created}</Text></View>
        <View style={s.card}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <View style={s.av}><Text style={s.avTxt}>{done.cName?.[0]?.toUpperCase()}</Text></View>
            <View><Text style={{ fontWeight: '800', fontSize: 15, color: C.text }}>{done.cName}</Text><Text style={{ fontSize: 12, color: C.textMuted }}>{done.cMob}</Text></View>
          </View>
          {(done.items || []).map((x, i) => <View key={i} style={s.itemRow}><Text style={{ color: C.text }}>{x.name} × {x.qty}</Text><Text style={{ fontWeight: '700', color: C.text }}>{rupee(x.qty * x.rate)}{t.perDay}</Text></View>)}
          <View style={[s.itemRow, { borderTopWidth: 2, borderTopColor: C.primary, marginTop: 6, paddingTop: 8 }]}>
            <Text style={{ fontWeight: '900', fontSize: 16, color: C.primary }}>{t.dailyRent}</Text>
            <Text style={{ fontWeight: '900', fontSize: 16, color: C.primary }}>{rupee(daily)}{t.perDay}</Text>
          </View>
        </View>
        <View style={s.actGrid}>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: C.whatsapp }]} onPress={shareWA}><Ionicons name="logo-whatsapp" size={16} color="#fff" /><Text style={s.actBtnTxt}>{t.shareWA}</Text></TouchableOpacity>
          <TouchableOpacity style={[s.actBtn, { backgroundColor: C.blue }]} onPress={() => navigation.navigate('Details')}><Ionicons name="document-text" size={16} color="#fff" /><Text style={s.actBtnTxt}>{t.details}</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={s.mainBtn} onPress={() => { setDone(null); setCust({ name: '', mob: '', addr: '', notes: '', ev: 'wedding', paidAmount: '' }); setItems([]); setIsVip(false); setGeneratedBy(store?.ownerName||''); }}>
          <Text style={s.mainBtnTxt}>{t.newOrdBtn}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.wrap}>
      <View style={s.header}><Text style={s.hTitle}>{t.newOrd.replace('+', '').trim()}</Text></View>
      <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
        {/* Customer */}
        <View style={s.card}>
          <Text style={s.secH}><Ionicons name="person" size={14} /> {t.custDet}</Text>
          <View style={s.row}><View style={s.col}><Text style={s.label}>{t.name} *</Text><TextInput style={s.input} placeholder={t.name} value={cust.name} onChangeText={v => cu('name', v)} placeholderTextColor={C.textMuted} /></View><View style={s.col}><Text style={s.label}>{t.mobile} *</Text><TextInput style={s.input} keyboardType="phone-pad" maxLength={10} placeholder="9876543210" value={cust.mob} onChangeText={v => cu('mob', v.replace(/\D/g, ''))} placeholderTextColor={C.textMuted} /></View></View>
          <Text style={s.label}>{t.event}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
            {EVENTS.map(ev => <TouchableOpacity key={ev} style={[s.chip, cust.ev === ev && s.chipOn]} onPress={() => cu('ev', ev)}><Text style={[s.chipTxt, cust.ev === ev && s.chipTxtOn]}>{t[ev]}</Text></TouchableOpacity>)}
          </ScrollView>
          <Text style={s.label}>{t.address} ({t.opt})</Text>
          <TextInput style={s.input} placeholder={t.opt} value={cust.addr} onChangeText={v => cu('addr', v)} placeholderTextColor={C.textMuted} />
        </View>

        {/* Products */}
        <View style={s.card}>
          <Text style={s.secH}><Ionicons name="cube" size={14} /> {t.selProd}</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {['All', ...new Set(products.map(p => p.category).filter(Boolean))].map(c => (
              <TouchableOpacity key={c} style={[s.catPill, selCat === c && s.catPillOn]} onPress={() => setSelCat(c)}>
                <Text style={[s.catTxt, selCat === c && s.catTxtOn]} numberOfLines={1}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {(selCat === 'All' ? products : products.filter(p => p.category === selCat)).map(p => {
            const r = getRented(p.name), a = p.totalQty - r, sel = items.find(i => i.pid === p.id);
            return (
              <View key={p.id} style={[s.selProd, sel && s.selProdOn, a <= 0 && { opacity: 0.3 }]}>
                <TouchableOpacity style={s.spTop} onPress={() => a > 0 && tog(p)} activeOpacity={0.7}>
                  <View style={s.spImg}>{p.image ? <Image source={{ uri: p.image }} style={s.spImgI} /> : <Ionicons name="cube-outline" size={18} color={C.textMuted} />}</View>
                  <View style={s.spInfo}><Text style={s.spName} numberOfLines={2}>{p.name}</Text><Text style={s.spMeta}>{rupee(p.rentPerDay)}{t.perDay} • {a} {t.avail}</Text></View>
                  <View style={[s.spCheck, sel && s.spCheckOn]}>{sel && <Ionicons name="checkmark" size={12} color="#fff" />}</View>
                </TouchableOpacity>
                {sel && (
                  <View style={s.spQty}>
                    <Text style={s.spQLabel}>{t.qty}:</Text>
                    <TouchableOpacity style={s.qBtn} onPress={() => setQ(p.id, sel.qty - 1)}><Ionicons name="remove" size={16} color={C.primary} /></TouchableOpacity>
                    <TextInput style={s.qInput} keyboardType="number-pad" value={String(sel.qty)} onChangeText={v => setQ(p.id, parseInt(v) || 1)} color={C.text} />
                    <TouchableOpacity style={s.qBtn} onPress={() => setQ(p.id, sel.qty + 1)}><Ionicons name="add" size={16} color={C.primary} /></TouchableOpacity>
                    <Text style={s.spLineTotal}>{rupee(sel.qty * sel.rate)}{t.perDay}</Text>
                  </View>
                )}
              </View>
            );
          })}
          {items.length > 0 && <View style={s.selSum}><Text style={{ color: C.text }}>{items.length} {t.items}</Text><Text style={{ fontWeight: '700', color: C.primary }}>{rupee(daily)}{t.perDay}</Text></View>}
        </View>

        {/* Date */}
        <View style={s.card}>
          <Text style={s.secH}><Ionicons name="calendar" size={14} /> {t.startDate}</Text>
          <TouchableOpacity style={s.dateBtn} onPress={() => setShowPicker(true)}>
            <Text style={s.dateShow}>{fDateLong(sd)}</Text>
            <Ionicons name="pencil" size={12} color={C.primary} />
          </TouchableOpacity>
          {showPicker && (
            <DateTimePicker
              value={new Date(sd)}
              mode="date"
              display="default"
              onChange={(e, d) => {
                setShowPicker(false);
                if (d) setSd(d.toISOString().split('T')[0]);
              }}
            />
          )}
        </View>

        {/* Advance Payment */}
        <View style={s.card}>
          <Text style={s.secH}><Ionicons name="cash" size={14} /> Advance Payment</Text>
          <TextInput style={s.input} keyboardType="number-pad" placeholder="e.g. 500" value={cust.paidAmount} onChangeText={v => cu('paidAmount', v)} placeholderTextColor={C.textMuted} />
          <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Optional. This will be deducted from the final bill.</Text>
        </View>

        {/* Options */}
        <View style={s.card}>
          <Text style={s.secH}><Ionicons name="options" size={14} /> Options</Text>
          <View style={s.row}>
            <TouchableOpacity style={[s.chip, isVip && s.chipOn]} onPress={() => setIsVip(!isVip)}>
              <Text style={[s.chipTxt, isVip && s.chipTxtOn]}>{t.vip}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[s.label, {marginTop:12}]}>{t.generatedBy}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
             <TouchableOpacity style={[s.chip, generatedBy === store?.ownerName && s.chipOn]} onPress={() => setGeneratedBy(store?.ownerName)}>
               <Text style={[s.chipTxt, generatedBy === store?.ownerName && s.chipTxtOn]}>{t.owner}</Text>
             </TouchableOpacity>
             {members.map(m => (
               <TouchableOpacity key={m.id} style={[s.chip, generatedBy === m.name && s.chipOn]} onPress={() => setGeneratedBy(m.name)}>
                 <Text style={[s.chipTxt, generatedBy === m.name && s.chipTxtOn]}>{m.name}</Text>
               </TouchableOpacity>
             ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={[s.mainBtn, !ok && { opacity: 0.3 }]} onPress={create} disabled={!ok || loading}>
          <Text style={s.mainBtnTxt}>{loading ? 'Creating...' : t.createBook}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = (C) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.primary, paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16 },
  hTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  body: { flex: 1, padding: 12 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  secH: { fontSize: 13, fontWeight: '800', marginBottom: 8, color: C.text },
  label: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', marginTop: 6, marginBottom: 2 },
  input: { backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 10, fontSize: 14, marginBottom: 4, color: C.text },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, marginRight: 4, backgroundColor: C.bg },
  chipOn: { borderColor: C.primary, backgroundColor: C.primary + '20' },
  chipTxt: { fontSize: 11, fontWeight: '600', color: C.textMuted },
  chipTxtOn: { color: C.primary },
  catPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: C.inputBg, marginRight: 8, borderWidth: 1, borderColor: C.border },
  catPillOn: { backgroundColor: C.primary, borderColor: C.primary },
  catTxt: { fontSize: 13, fontWeight: '700', color: C.textMuted },
  catTxtOn: { color: '#fff' },
  selProd: { borderWidth: 2, borderColor: C.border, borderRadius: 12, padding: 8, marginBottom: 5 },
  selProdOn: { borderColor: C.primary, backgroundColor: C.primary + '10' },
  spTop: { flexDirection: 'row', alignItems: 'center' },
  spImg: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  spImgI: { width: 34, height: 34, borderRadius: 8 },
  spInfo: { flex: 1, paddingHorizontal: 10, flexShrink: 1 },
  spName: { fontSize: 14, fontWeight: '700', color: C.text },
  spMeta: { fontSize: 10, color: C.textMuted },
  spCheck: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  spCheckOn: { backgroundColor: C.primary, borderColor: C.primary },
  spQty: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.border },
  spQLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted },
  qBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  qInput: { width: 42, textAlign: 'center', borderWidth: 1.5, borderColor: C.border, borderRadius: 7, fontSize: 15, fontWeight: '800', padding: 3 },
  spLineTotal: { marginLeft: 'auto', fontWeight: '800', color: C.primary, fontSize: 12 },
  selSum: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.primary + '15', borderRadius: 8, padding: 8, marginTop: 6 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary + '15', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  dateShow: { fontSize: 14, fontWeight: '700', color: C.primary },
  mainBtn: { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 6 },
  mainBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  succBox: { alignItems: 'center', padding: 20, backgroundColor: C.greenLight, borderRadius: 14, marginBottom: 8 },
  succTxt: { fontSize: 18, fontWeight: '900', color: C.green },
  av: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, fontSize: 12 },
  actGrid: { flexDirection: 'row', gap: 6, marginTop: 8 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 11, borderRadius: 10 },
  actBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
