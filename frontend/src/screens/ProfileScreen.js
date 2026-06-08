import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../utils/AppContext';
import { useTheme } from '../utils/ThemeContext';
import { updateProfile, getMembers, createMember, deleteMember } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen({ navigation }) {
  const { store, setStore, t, logout } = useApp();
  const { theme: C, themeName, changeTheme } = useTheme();
  const s = useStyles(C);
  
  const [storeName, setStoreName] = useState(store?.storeName || '');
  const [ownerName, setOwnerName] = useState(store?.ownerName || '');
  const [address, setAddress] = useState(store?.address || '');
  const [signature, setSignature] = useState(store?.createdBySignature || null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [addingStaff, setAddingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffSig, setNewStaffSig] = useState(null);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const res = await getMembers();
      setMembers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const pickImage = async (setImgFunc) => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!res.canceled && res.assets[0].base64) {
      setImgFunc(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const saveProfile = async () => {
    if (!storeName || !ownerName) return Alert.alert('Error', t.allReq);
    setLoading(true);
    try {
      const res = await updateProfile({ storeName, address, createdBySignature: signature });
      setStore(res.data.store);
      await AsyncStorage.setItem('store', JSON.stringify(res.data.store));
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (e) {
      Alert.alert('Error', 'Failed to update profile');
    }
    setLoading(false);
  };

  const saveLang = async (newLang) => {
    setLoading(true);
    try {
      const res = await updateProfile({ lang: newLang });
      setStore(res.data.store);
      await AsyncStorage.setItem('store', JSON.stringify(res.data.store));
    } catch (e) {
      Alert.alert('Error', 'Failed to update language');
    }
    setLoading(false);
  };

  const saveStaff = async () => {
    if (!newStaffName) return Alert.alert('Error', t.allReq);
    setLoading(true);
    try {
      await createMember({ name: newStaffName, signature: newStaffSig });
      setAddingStaff(false);
      setNewStaffName('');
      setNewStaffSig(null);
      loadMembers();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to add staff');
    }
    setLoading(false);
  };

  const delStaff = (id) => {
    Alert.alert(t.delStaff, t.delConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.del, style: 'destructive', onPress: async () => {
        try {
          await deleteMember(id);
          loadMembers();
        } catch (e) {
          Alert.alert('Error', 'Failed to delete staff');
        }
      }}
    ]);
  };

  return (
    <ScrollView style={s.wrap}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>{t.profile}</Text>
        <View style={{width:24}} />
      </View>

      <View style={s.section}>
        <Text style={s.secTitle}>{t.owner}</Text>
        <TextInput style={s.input} value={storeName} onChangeText={setStoreName} placeholder={t.storeName} placeholderTextColor={C.textMuted} />
        <TextInput style={[s.input, {opacity: 0.7}]} value={ownerName} onChangeText={setOwnerName} placeholder={t.ownerName} editable={false} placeholderTextColor={C.textMuted} />
        <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder={t.address} multiline placeholderTextColor={C.textMuted} />
        
        <Text style={s.lbl}>{t.ownerSign}</Text>
        <TouchableOpacity style={s.imgBox} onPress={() => pickImage(setSignature)}>
          {signature ? <Image source={{ uri: signature }} style={s.img} /> : <Text style={s.imgTxt}>{t.upload}</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity style={s.saveBtn} onPress={saveProfile} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>{t.save}</Text>}
        </TouchableOpacity>
      </View>

      <View style={s.section}>
        <View style={s.row}>
          <Text style={s.secTitle}>{t.staffMembers}</Text>
          <Text style={s.maxTxt}>{t.membersMax}</Text>
        </View>

        {members.length === 0 && !addingStaff && <Text style={s.empty}>{t.noStaff}</Text>}
        {members.map(m => (
          <View key={m.id} style={s.memberCard}>
            <View style={{flex:1}}>
              <Text style={s.mName}>{m.name}</Text>
              {m.signature && <Image source={{ uri: m.signature }} style={s.mSig} />}
            </View>
            <TouchableOpacity onPress={() => delStaff(m.id)}>
              <Ionicons name="trash-outline" size={20} color={C.red} />
            </TouchableOpacity>
          </View>
        ))}

        {addingStaff ? (
          <View style={s.addForm}>
            <TextInput style={s.input} value={newStaffName} onChangeText={setNewStaffName} placeholder={t.name} placeholderTextColor={C.textMuted} />
            <Text style={s.lbl}>{t.signature}</Text>
            <TouchableOpacity style={s.imgBox} onPress={() => pickImage(setNewStaffSig)}>
              {newStaffSig ? <Image source={{ uri: newStaffSig }} style={s.img} /> : <Text style={s.imgTxt}>{t.upload}</Text>}
            </TouchableOpacity>
            <View style={s.fRow}>
              <TouchableOpacity style={s.fBtnC} onPress={() => setAddingStaff(false)}><Text style={s.fTxtC}>{t.cancel}</Text></TouchableOpacity>
              <TouchableOpacity style={s.fBtnS} onPress={saveStaff} disabled={loading}><Text style={s.fTxtS}>{t.save}</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          members.length < 5 && (
            <TouchableOpacity style={s.addBtn} onPress={() => setAddingStaff(true)}>
              <Text style={s.addTxt}>{t.addStaff}</Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <View style={s.section}>
        <Text style={s.secTitle}>⚙️ Settings</Text>
        <Text style={s.lbl}>{t.lang}</Text>
        <View style={s.row}>
          <TouchableOpacity style={[s.langBtn, store?.lang === 'en' && s.langOn]} onPress={() => saveLang('en')}>
            <Text style={[s.langTxt, store?.lang === 'en' && s.langTxtOn]}>🇬🇧 English</Text>
          </TouchableOpacity>
          <View style={{width:8}} />
          <TouchableOpacity style={[s.langBtn, store?.lang === 'ta' && s.langOn]} onPress={() => saveLang('ta')}>
            <Text style={[s.langTxt, store?.lang === 'ta' && s.langTxtOn]}>🇮🇳 தமிழ்</Text>
          </TouchableOpacity>
        </View>

        <Text style={[s.lbl, { marginTop: 16 }]}>{t.theme || 'Theme Color'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
          {[
            { id: 'Terracotta', color: '#D84315', name: 'Terracotta' },
            { id: 'Emerald', color: '#059669', name: 'Emerald' },
            { id: 'Indigo', color: '#4F46E5', name: 'Indigo' },
            { id: 'DarkMode', color: '#1A1A1A', name: 'Dark Mode' }
          ].map(th => (
            <TouchableOpacity 
              key={th.id} 
              style={[s.themeBtn, { borderColor: themeName === th.id ? C.primary : C.border }]} 
              onPress={() => changeTheme(th.id)}
            >
              <View style={[s.themeDot, { backgroundColor: th.color }]} />
              <Text style={[s.themeTxt, themeName === th.id && { color: C.primary, fontWeight: '800' }]}>{th.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.red, marginTop: 24 }]} onPress={logout}>
          <Text style={s.saveTxt}>{t.logout || 'Logout'}</Text>
        </TouchableOpacity>
      </View>
      <View style={{height: 40}}/>
    </ScrollView>
  );
}

const useStyles = (C) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 48, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  section: { backgroundColor: C.card, margin: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  secTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, color: C.primary },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15, color: C.text, backgroundColor: C.inputBg },
  lbl: { fontSize: 13, fontWeight: '700', marginBottom: 8, color: C.textMuted },
  imgBox: { height: 100, borderWidth: 1, borderColor: C.border, borderRadius: 8, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden', backgroundColor: C.inputBg },
  imgTxt: { color: C.textMuted, fontSize: 13 },
  img: { width: '100%', height: '100%', resizeMode: 'contain' },
  saveBtn: { backgroundColor: C.primary, padding: 14, borderRadius: 8, alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  maxTxt: { fontSize: 11, color: C.textMuted },
  empty: { fontSize: 13, color: C.textMuted, fontStyle: 'italic', marginBottom: 12 },
  memberCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: C.border, borderRadius: 8, marginBottom: 8, backgroundColor: C.inputBg },
  mName: { fontSize: 15, fontWeight: '700', color: C.text },
  mSig: { width: 60, height: 30, resizeMode: 'contain', marginTop: 4 },
  addBtn: { backgroundColor: C.primary + '15', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  addTxt: { color: C.primary, fontWeight: '800', fontSize: 14 },
  addForm: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  fRow: { flexDirection: 'row', gap: 8 },
  fBtnC: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: C.card, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  fTxtC: { color: C.text, fontWeight: '700' },
  fBtnS: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: C.primary, alignItems: 'center' },
  fTxtS: { color: '#fff', fontWeight: '800' },
  langBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', backgroundColor: C.card },
  langOn: { borderColor: C.primary, backgroundColor: C.primary + '15' },
  langTxt: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  langTxtOn: { color: C.primary },
  themeBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1.5, marginRight: 8, backgroundColor: C.card },
  themeDot: { width: 14, height: 14, borderRadius: 7, marginRight: 8 },
  themeTxt: { fontSize: 13, fontWeight: '600', color: C.textMuted }
});
