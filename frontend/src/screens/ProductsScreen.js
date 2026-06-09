import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Image, Modal, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../utils/AppContext';
import { rupee } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { getProducts, createProduct, updateProduct, deleteProduct, getBookings } from '../utils/api';

export default function ProductsScreen({ navigation }) {
  const { t, products, setProducts, bookings, setBookings } = useApp();
  const { theme: C } = useTheme();
  const s = useStyles(C);
  
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', totalQty: '', rentPerDay: '', category: '', image: null });
  const [refreshing, setRefreshing] = useState(false);
  const [catFilter, setCatFilter] = useState('All');
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const [pRes, bRes] = await Promise.all([getProducts(), getBookings()]);
      setProducts(pRes.data); setBookings(bRes.data);
    } catch (e) {}
  }, []);

  useEffect(() => { load(); }, []);
  useEffect(() => { const unsub = navigation.addListener('focus', load); return unsub; }, [navigation]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const getRented = (name) => bookings.filter(b => b.status === 'ACTIVE' && !b.isDeleted).reduce((s2, b) => {
    const it = (b.items || []).find(i => i.name === name); return s2 + (it ? it.qty : 0);
  }, 0);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!result.canceled) u('image', `data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  const save = async () => {
    if (!form.name || !form.totalQty || !form.rentPerDay) return Alert.alert('Error', t.allReq);
    try {
      if (editId) {
        const res = await updateProduct(editId, form);
        setProducts(products.map(p => p.id === editId ? res.data : p));
      } else {
        const res = await createProduct(form);
        setProducts([res.data, ...products]);
      }
      setModal(false); setEditId(null);
      setForm({ name: '', totalQty: '', rentPerDay: '', category: '', image: null });
    } catch (e) { Alert.alert('Error', 'Failed to save'); }
  };

  const del = (pid) => Alert.alert(t.del, t.del + '?', [
    { text: t.cancel, style: 'cancel' },
    { text: t.del, style: 'destructive', onPress: async () => {
      try { await deleteProduct(pid); setProducts(products.filter(p => p.id !== pid)); } catch (e) {}
    }}
  ]);

  const edit = (p) => {
    setEditId(p.id);
    setForm({ name: p.name, totalQty: String(p.totalQty), rentPerDay: String(p.rentPerDay), category: p.category || '', image: p.image });
    setModal(true);
  };

  const ts = products.reduce((s2, p) => s2 + p.totalQty, 0);
  const tr = products.reduce((s2, p) => s2 + getRented(p.name), 0);

  return (
    <View style={s.wrap}>
      <View style={s.header}><Text style={s.hTitle}>{t.products}</Text><Text style={s.hSub}>{products.length} items</Text></View>
      <ScrollView style={s.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}>
        {products.length > 0 && (
          <View style={s.sumBar}>
            <View style={s.sumItem}><Text style={[s.sumVal, { color: C.blue }]}>{ts}</Text><Text style={s.sumLbl}>{t.total}</Text></View>
            <View style={s.sumDiv} />
            <View style={s.sumItem}><Text style={[s.sumVal, { color: C.orange }]}>{tr}</Text><Text style={s.sumLbl}>{t.rented}</Text></View>
            <View style={s.sumDiv} />
            <View style={s.sumItem}><Text style={[s.sumVal, { color: C.green }]}>{ts - tr}</Text><Text style={s.sumLbl}>{t.avail}</Text></View>
          </View>
        )}
        
        {products.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catWrap}>
            {['All', ...new Set(products.map(p => p.category).filter(Boolean))].map(cat => (
              <TouchableOpacity key={cat} style={[s.catPill, catFilter === cat && s.catPillOn]} onPress={() => setCatFilter(cat)}>
                <Text style={[s.catTxt, catFilter === cat && s.catTxtOn]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {(catFilter === 'All' ? products : products.filter(p => p.category === catFilter)).map(p => {
          const r = getRented(p.name), a = p.totalQty - r;
          const pct = p.totalQty > 0 ? (a / p.totalQty) * 100 : 0;
          const bc = pct > 50 ? C.teal : pct > 20 ? C.yellow : C.red;
          return (
            <View key={p.id} style={s.prodCard}>
              <View style={s.pcTop}>
                <View style={s.pcImg}>{p.image ? <Image source={{ uri: p.image }} style={s.pcImgI} /> : <Ionicons name="camera-outline" size={20} color={C.textMuted} />}</View>
                <View style={s.pcInfo}><Text style={s.pcName}>{p.name}</Text><Text style={s.pcRate}>{rupee(p.rentPerDay)}<Text style={s.pcRateSub}>{t.perDay}</Text></Text></View>
                <TouchableOpacity style={s.ib} onPress={() => edit(p)}><Ionicons name="pencil" size={14} color={C.textMuted} /></TouchableOpacity>
                <TouchableOpacity style={[s.ib, { marginLeft: 4 }]} onPress={() => del(p.id)}><Ionicons name="trash" size={14} color={C.red} /></TouchableOpacity>
              </View>
              <View style={s.pcBarWrap}><View style={[s.pcBarFill, { width: `${pct}%`, backgroundColor: bc }]} /></View>
              <View style={s.pcMeta}>
                <Text style={[s.pcMetaTxt, { color: bc, fontWeight: '800' }]}>{t.avail}: {a}</Text>
                <Text style={s.pcMetaTxt}>{t.rented}: {r}</Text>
                <Text style={s.pcMetaTxt}>{t.total}: {p.totalQty}</Text>
              </View>
            </View>
          );
        })}
        {products.length === 0 && (
          <View style={s.empty}><Text style={{ fontSize: 42 }}>📦</Text><Text style={s.empTitle}>{t.noProd}</Text><Text style={s.empSub}>{t.addFirst}</Text>
            <TouchableOpacity style={s.empBtn} onPress={() => setModal(true)}><Text style={s.empBtnTxt}>+ {t.addProd}</Text></TouchableOpacity>
          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>
      <TouchableOpacity style={s.fab} onPress={() => { setEditId(null); setForm({ name: '', totalQty: '', rentPerDay: '', category: '', image: null }); setModal(true); }}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
      <Modal visible={modal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalBg}>
          <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'flex-end'}} keyboardShouldPersistTaps="handled">
            <View style={s.sheet}>
          <View style={s.shHandle} />
          <Text style={s.shTitle}>{editId ? t.editProd : t.addProd}</Text>
          <Text style={s.label}>{t.imgProd}</Text>
          <TouchableOpacity style={s.imgUpload} onPress={pickImage}>
            {form.image ? <Image source={{ uri: form.image }} style={s.imgPrev} /> : <View style={s.imgPh}><Ionicons name="camera" size={28} color={C.textMuted} /><Text style={s.imgPhTxt}>{t.upload}</Text></View>}
          </TouchableOpacity>
          <Text style={s.label}>{t.prodName} *</Text>
          <TextInput style={s.input} placeholder="Chair, Table, Vessel..." value={form.name} onChangeText={v => u('name', v)} placeholderTextColor={C.textMuted} />
          <View style={s.row}>
            <View style={s.col}><Text style={s.label}>{t.totalQty} *</Text><TextInput style={s.input} keyboardType="number-pad" placeholder="100" value={form.totalQty} onChangeText={v => u('totalQty', v)} placeholderTextColor={C.textMuted} /></View>
            <View style={s.col}><Text style={s.label}>{t.rentDay} *</Text><TextInput style={s.input} keyboardType="number-pad" placeholder="10" value={form.rentPerDay} onChangeText={v => u('rentPerDay', v)} placeholderTextColor={C.textMuted} /></View>
          </View>
          <Text style={s.label}>Category ({t.opt})</Text>
          <TextInput style={s.input} placeholder="Furniture, Tent..." value={form.category} onChangeText={v => u('category', v)} placeholderTextColor={C.textMuted} />
          <TouchableOpacity style={s.saveBtn} onPress={save}><Text style={s.saveBtnTxt}>{editId ? '✓ Update' : '+ ' + t.addProd}</Text></TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(false)}><Text style={s.cancelBtnTxt}>{t.cancel}</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = (C) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.primary, paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16 },
  hTitle: { color: '#fff', fontSize: 20, fontWeight: '900' }, hSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  body: { flex: 1, padding: 12 },
  sumBar: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8, alignItems: 'center' },
  sumItem: { flex: 1, alignItems: 'center' }, sumVal: { fontSize: 16, fontWeight: '900' },
  sumLbl: { fontSize: 8, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase' }, sumDiv: { width: 1, height: 24, backgroundColor: C.border },
  catWrap: { flexDirection: 'row', marginBottom: 12, paddingBottom: 4 },
  catPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  catPillOn: { backgroundColor: C.primary, borderColor: C.primary },
  catTxt: { fontSize: 12, fontWeight: '700', color: C.text },
  catTxtOn: { color: '#fff' },
  prodCard: { backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  pcTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pcImg: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.inputBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pcImgI: { width: 46, height: 46, borderRadius: 12 },
  pcInfo: { flex: 1 }, pcName: { fontSize: 16, fontWeight: '800', color: C.text },
  pcRate: { fontSize: 14, fontWeight: '800', color: C.primary }, pcRateSub: { fontSize: 10, fontWeight: '600', color: C.textMuted },
  ib: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  pcBarWrap: { height: 7, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden', marginVertical: 8 },
  pcBarFill: { height: '100%', borderRadius: 4 },
  pcMeta: { flexDirection: 'row', gap: 12 }, pcMetaTxt: { fontSize: 11, fontWeight: '600', color: C.textMuted },
  empty: { alignItems: 'center', padding: 30, backgroundColor: C.card, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, marginTop: 20 },
  empTitle: { fontSize: 16, fontWeight: '800', marginTop: 4, color: C.text }, empSub: { fontSize: 12, color: C.textMuted },
  empBtn: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, marginTop: 12 },
  empBtnTxt: { color: '#fff', fontWeight: '700' },
  fab: { position: 'absolute', bottom: 70, right: 16, width: 52, height: 52, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '85%' },
  shHandle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  shTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, color: C.text },
  label: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', marginTop: 8, marginBottom: 3 },
  input: { backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 11, fontSize: 14, marginBottom: 4, color: C.text },
  row: { flexDirection: 'row', gap: 8 }, col: { flex: 1 },
  imgUpload: { height: 100, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6 },
  imgPrev: { width: '100%', height: '100%' }, imgPh: { alignItems: 'center' }, imgPhTxt: { fontSize: 10, color: C.textMuted, marginTop: 2 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn: { borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 6 },
  cancelBtnTxt: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
});
