import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Modal, Image, Switch, FlatList } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useApp } from '../utils/AppContext';
import { rupee, fDate, todayISO, daysBetween } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { getBooking, updateBooking, deleteBooking, addDamage, deleteDamage, getMembers } from '../utils/api';

export default function OrderDetailScreen({ route, navigation }) {
  const { t, store, bookings, setBookings } = useApp();
  const { theme: C } = useTheme();
  const s = useStyles(C);
  
  const { bookingId } = route.params;
  const [b, setB] = useState(null);
  const [rd, setRd] = useState(todayISO());
  const [vip, setVip] = useState(false);
  const [cdisc, setCdisc] = useState('');
  const [showDmg, setShowDmg] = useState(false);
  const [dmgForm, setDmgForm] = useState({ product: '', qty: '', rate: '' });
  const [loading, setLoading] = useState(true);
  const [sig, setSig] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  
  const [members, setMembers] = useState([]);
  const [showAdminModal, setShowAdminModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getBooking(bookingId);
        setB(res.data);
        setRd(res.data.returnDate || todayISO());
        setVip(res.data.isVip || false);
        setCdisc(String(res.data.discount || ''));
        
        const mRes = await getMembers();
        setMembers(mRes.data);

        if (res.data.generatedBy && res.data.generatedBy !== store?.ownerName) {
           const mem = mRes.data.find(m => m.name === res.data.generatedBy);
           if (mem) setSig(mem.signature);
        } else {
           setSig(store?.createdBySignature);
        }
      } catch (e) { Alert.alert('Error', 'Failed to load'); navigation.goBack(); }
      setLoading(false);
    })();
  }, [bookingId]);

  if (loading || !b) return <View style={s.wrap}><View style={s.header}><Text style={s.hTitle}>Loading...</Text></View></View>;

  const days = daysBetween(b.startDate, rd);
  const sub = (b.items || []).reduce((s2, i) => s2 + i.qty * i.rate * days, 0);
  const dmgAmt = (b.damages || []).reduce((s2, d) => s2 + d.qty * d.rate, 0);
  const disc = vip ? Math.round(sub * 0.5) : (+cdisc || 0);
  const total = Math.max(0, sub - disc) + dmgAmt;
  const adv = b.paidAmount || 0;
  const addl = b.additionalPayment || 0;
  const totalReceived = adv + addl;
  const diff = adv - total; // As per CASE 2: difference = advancePaid - totalAmount
  
  // Actually the formula said: if difference > 0, refund = diff, balance = 0.
  // Wait, does additionalPayment count towards difference? 
  // "Formula: difference = advancePaid - totalAmount"
  // If they don't want additionalPayment in the difference formula... wait, additional payment IS money received.
  // Let's use totalReceived for balance calculations.
  const rem = total - totalReceived;
  const balDue = Math.max(rem, 0);
  const refDue = Math.max(-rem, 0);
  const isPaid = balDue <= 0 && total > 0; // Or just balDue <= 0


  const save = async (extra = {}) => {
    try {
      const res = await updateBooking(b.id, { returnDate: rd, totalDays: days, subtotal: sub, discount: disc, totalAmount: total, isVip: vip, ...extra });
      setB(res.data);
      setBookings(bookings.map(x => x.id === b.id ? res.data : x));
    } catch (e) { Alert.alert('Error', 'Failed to update'); }
  };

  const toggleReturned = async (val) => {
    await save({ returned: val, ...(val ? { actualReturnDate: rd } : { actualReturnDate: null }) });
  };

  const handleUpdateAdv = () => {
    Alert.prompt(
      "Update Payment",
      "Enter additional payment received (excluding advance):",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Save", onPress: async (val) => {
            const v = parseFloat(val);
            if (!isNaN(v)) {
              const newBal = total - (adv + v);
              await save({ additionalPayment: v, paid: newBal <= 0 });
            }
          }
        }
      ],
      "plain-text",
      String(addl),
      "number-pad"
    );
  };

  const handleAddDmg = async () => {
    if (!dmgForm.product || !dmgForm.qty || !dmgForm.rate) return;
    try {
      await addDamage(b.id, dmgForm);
      const res = await getBooking(b.id);
      setB(res.data);
      setBookings(bookings.map(x => x.id === b.id ? res.data : x));
      setDmgForm({ product: '', qty: '', rate: '' });
      setShowDmg(false);
    } catch (e) { Alert.alert('Error', 'Failed'); }
  };

  const handleDelDmg = async (did) => {
    try {
      await deleteDamage(did);
      const res = await getBooking(b.id);
      setB(res.data);
    } catch (e) {}
  };

  const handleDelete = () => Alert.alert(t.delOrder, t.delConfirm, [
    { text: t.cancel, style: 'cancel' },
    { text: t.del, style: 'destructive', onPress: async () => {
      try { 
        setBookings(bookings.map(x => x.id === b.id ? { ...x, isDeleted: true } : x)); 
        navigation.goBack(); 
        await deleteBooking(b.id); 
      } catch (e) {
        Alert.alert("Error", "Failed to delete order on server");
      } 
    }}
  ]);

  const invTxt = () => {
    const d = days || 1;
    let txt = `🏪 *${store.storeName}*\n📋 Invoice\n${'─'.repeat(24)}\n\n👤 *${b.cName}*\n📱 ${b.cMob}\n📅 ${fDate(b.startDate)}${b.returnDate ? ` → ${fDate(b.returnDate)}` : ''}\n${days ? `⏱️ *${days} Days*\n` : ''}\n*Items:*\n`;
    (b.items || []).forEach(i => { txt += `  • ${i.name} × ${i.qty} = ${rupee(i.qty * i.rate * d)}\n`; });
    if ((b.damages || []).length) { txt += `\n*Damages:*\n`; b.damages.forEach(x => { txt += `  ⚠️ ${x.product} × ${x.qty} = ${rupee(x.qty * x.rate)}\n`; }); }
    if (disc > 0) txt += `\n💸 Discount: -${rupee(disc)}\n`;
    txt += `\n${'━'.repeat(24)}\n💰 *TOTAL: ${rupee(total)}*\n`;
    
    if (adv > 0) txt += `💵 Advance Paid: -${rupee(adv)}\n`;
    if (addl > 0) txt += `💵 Additional Paid: -${rupee(addl)}\n`;
    
    if (adv > 0) {
      if (refDue > 0) txt += `🔖 Refund Amount: ${rupee(refDue)}\n`;
      else txt += `🔖 Balance Due: ${rupee(balDue)}\n`;
    } else {
      txt += `🔖 Pending Amount: ${rupee(balDue)}\n`;
    }
    
    txt += `\n${isPaid ? '✅ PAID' : '⏳ UNPAID'}\n\n🙏 Thank you!\n_${b.generatedBy || store.ownerName}_\n🏪 ${store.storeName}`;
    return txt;
  };

  const shareWA = () => Linking.openURL(`https://wa.me/${b.cMob?.replace(/\D/g, '')}?text=${encodeURIComponent(invTxt())}`);
  
  const sendReminder = () => {
    Linking.openURL(`https://wa.me/${b.cMob?.replace(/\D/g, '')}?text=${encodeURIComponent(`🔔 *Payment Reminder*\n\nDear ${b.cName},\nPending: *${rupee(balDue)}*\n🏪 ${store.storeName}\n\nPlease settle soon. 🙏`)}`);
  };

  const generatePDFWithAdmin = async (adminName, signatureBase64) => {
    setShowAdminModal(false);
    // Optimistically update
    setSig(signatureBase64);
    await save({ generatedBy: adminName });
    
    const d = days || 1;
    const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;max-width:400px;margin:auto;padding:16px;color:#1a1a2e}.h{text-align:center;border-bottom:3px solid ${C.primary};padding-bottom:12px}.h h1{color:${C.primary};font-size:22px}table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#FBE9E7;color:${C.primary};font-size:10px;padding:6px;text-align:left}td{padding:6px;font-size:12px;border-bottom:1px solid #f5f5f5}td:last-child{text-align:right}.t{background:${C.primary};color:#fff;padding:12px;border-radius:8px;display:flex;justify-content:space-between;margin:8px 0;font-weight:900}</style></head><body><div class="h"><h1>${store.storeName}</h1><p style="font-size:11px;color:#888">${store.ownerName} • ${store.mobile}</p></div><p style="padding:8px 0;font-weight:700">${b.cName} • ${b.cMob}</p><p style="font-size:12px;color:#666">${fDate(b.startDate)}${b.returnDate ? ` → ${fDate(b.returnDate)}` : ''} • ${d} Days</p><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th style="text-align:right">Amt</th></tr></thead><tbody>${(b.items || []).map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>${rupee(i.rate)}</td><td style="text-align:right">${rupee(i.qty * i.rate * d)}</td></tr>`).join('')}${(b.damages || []).map(x => `<tr style="color:#C62828"><td>⚠ ${x.product}</td><td>${x.qty}</td><td>${rupee(x.rate)}</td><td style="text-align:right">${rupee(x.qty * x.rate)}</td></tr>`).join('')}</tbody></table>${disc > 0 ? `<p style="text-align:right;color:#2E7D32;font-size:12px">Discount: -${rupee(disc)}</p>` : ''}<div class="t"><span>Total Bill</span><span style="font-size:20px">${rupee(total)}</span></div>${adv > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span>Advance Paid</span><span style="color:#2E7D32">-${rupee(adv)}</span></div>` : ''}${addl > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span>Additional Paid</span><span style="color:#2E7D32">-${rupee(addl)}</span></div>` : ''}${adv > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;font-weight:800"><span>${refDue > 0 ? 'Refund Amount' : 'Balance Due'}</span><span>${rupee(refDue > 0 ? refDue : balDue)}</span></div>` : `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;font-weight:800"><span>Pending Amount</span><span>${rupee(balDue)}</span></div>`}<p style="text-align:center;padding:6px;border-radius:6px;font-weight:700;margin-top:8px;background:${isPaid ? '#E8F5E9' : '#FFEBEE'};color:${isPaid ? '#2E7D32' : '#C62828'}">${isPaid ? '✓ PAID' : '⏳ UNPAID'}</p><p style="text-align:center;font-size:12px;color:#888;margin-top:20px">Thank you! 🙏</p><div style="text-align:right; margin-top:10px;">${signatureBase64 ? `<img src="${signatureBase64}" style="height:40px; object-fit:contain; margin-bottom:4px;" /><br/>` : ''}<span style="font-size:11px; color:#555; font-weight:bold;">${adminName || store.ownerName}</span></div></body></html>`;
    try { const { uri } = await Print.printToFileAsync({ html }); await Sharing.shareAsync(uri); } catch (e) {}
  };

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="arrow-back" size={20} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t.orderDet}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.delBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={14} color={C.red} /><Text style={s.delBtnTxt}>{t.delOrder}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.body}>
        {/* Customer Hero */}
        <View style={s.hero}>
          <View style={s.heroAv}><Text style={s.heroAvTxt}>{b.cName?.[0]?.toUpperCase()}</Text></View>
          <Text style={s.heroName}>{b.cName}</Text>
          <Text style={s.heroPhone}><Ionicons name="call" size={11} color="rgba(255,255,255,0.8)" /> {b.cMob}</Text>
          {b.eventType && <Text style={s.heroEvent}>{b.eventType}</Text>}
        </View>

        {/* Items */}
        <View style={s.card}>
          <Text style={s.secH}>📦 {t.items}</Text>
          {(b.items || []).map((it, i) => (
            <View key={i} style={s.itemRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {it.image ? <Image source={{ uri: it.image }} style={s.itemImg} /> : <View style={s.itemNoImg}><Ionicons name="cube-outline" size={14} color={C.textMuted} /></View>}
                <View>
                  <Text style={s.itemName}>{it.name}</Text>
                  <Text style={s.itemCalc}>{it.qty} × {rupee(it.rate)}{days > 0 ? ` × ${days}d` : t.perDay}</Text>
                </View>
              </View>
              <Text style={s.itemAmt}>{days > 0 ? rupee(it.qty * it.rate * days) : `${rupee(it.qty * it.rate)}${t.perDay}`}</Text>
            </View>
          ))}
        </View>

        {/* Return Date & Billing */}
        <View style={s.card}>
          <Text style={s.secH}>📅 {t.retBill}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Text style={s.label}>{t.startDate}</Text><View style={s.dateBox}><Text style={s.dateTxt}>{fDate(b.startDate)}</Text></View></View>
            <View style={{ flex: 1 }}><Text style={s.label}>{t.retDate} *</Text>
              <TouchableOpacity style={s.dateBox} onPress={() => setShowPicker(true)}>
                <Text style={s.dateTxt}>{fDate(rd)}</Text>
              </TouchableOpacity>
              {showPicker && (
                <DateTimePicker value={new Date(rd)} mode="date" onChange={(e, d) => { setShowPicker(false); if (d) setRd(d.toISOString().split('T')[0]); }} />
              )}
            </View>
          </View>
          {days > 0 && <View style={s.dayChip}><Text style={s.dayChipTxt}>{days} {days > 1 ? t.days : t.day}</Text></View>}
          
          <View style={s.togRow}>
            <Text style={s.togLabel}>{t.specRate}</Text>
            <Switch value={vip} onValueChange={(val) => { setVip(val); if (val) setCdisc(''); }} trackColor={{ false: '#D7CCC8', true: C.green }} thumbColor="#fff" />
          </View>
          {!vip && <><Text style={s.label}>{t.custDisc}</Text><TextInput style={s.input} keyboardType="number-pad" placeholder="0" value={cdisc} onChangeText={setCdisc} /></>}
          
          <TouchableOpacity style={s.saveCalcBtn} onPress={() => save()}>
            <Text style={s.saveCalcTxt}>💾 Save Calculation</Text>
          </TouchableOpacity>
        </View>

        {/* Damages list */}
        {(b.damages || []).length > 0 && (
          <View style={s.card}>
            <Text style={s.secH}>⚠️ {t.damages}</Text>
            {b.damages.map(d => (
              <View key={d.id} style={s.dmgRow}>
                <View><Text style={s.dmgName}>{d.product}</Text><Text style={s.dmgCalc}>{d.qty} × {rupee(d.rate)}</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.dmgAmt}>{rupee(d.qty * d.rate)}</Text>
                  <TouchableOpacity onPress={() => handleDelDmg(d.id)}><Ionicons name="close-circle" size={20} color={C.red} /></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Bill Summary */}
        {days > 0 && (
          <View style={[s.card, { borderWidth: 2, borderColor: C.primary }]}>
            <Text style={s.secH}>💰 {t.billSum}</Text>
            {(b.items || []).map((it, i) => (
              <View key={i} style={s.billRow}><Text style={s.billTxt}>{it.name} × {it.qty} × {days}d</Text><Text style={s.billTxt}>{rupee(it.qty * it.rate * days)}</Text></View>
            ))}
            {disc > 0 && <View style={s.billRow}><Text style={[s.billTxt, { color: C.green }]}>{t.disc}</Text><Text style={[s.billTxt, { color: C.green }]}>-{rupee(disc)}</Text></View>}
            {dmgAmt > 0 && <View style={s.billRow}><Text style={[s.billTxt, { color: C.red }]}>⚠️ {t.dmgChg}</Text><Text style={[s.billTxt, { color: C.red }]}>+{rupee(dmgAmt)}</Text></View>}
            <View style={s.billTotal}><Text style={s.billTotalTxt}>{t.total}</Text><Text style={s.billTotalTxt}>{rupee(total)}</Text></View>
            
            {adv > 0 ? (
              <>
                <View style={[s.billRow, { marginTop: 6 }]}><Text style={s.billTxt}>Advance Paid</Text><Text style={[s.billTxt, { color: C.green }]}>-{rupee(adv)}</Text></View>
                {addl > 0 && <View style={s.billRow}><Text style={s.billTxt}>Additional Paid</Text><Text style={[s.billTxt, { color: C.green }]}>-{rupee(addl)}</Text></View>}
                <View style={s.billRow}><Text style={{ fontWeight: '800', color: C.text }}>{refDue > 0 ? 'Refund Amount' : 'Balance Due'}</Text><Text style={{ fontWeight: '900', color: refDue > 0 ? C.primary : C.text }}>{rupee(refDue > 0 ? refDue : balDue)}</Text></View>
              </>
            ) : (
              <>
                {addl > 0 && <View style={[s.billRow, { marginTop: 6 }]}><Text style={s.billTxt}>Additional Paid</Text><Text style={[s.billTxt, { color: C.green }]}>-{rupee(addl)}</Text></View>}
                <View style={[s.billRow, { marginTop: adv > 0 || addl > 0 ? 0 : 6 }]}><Text style={{ fontWeight: '800', color: C.text }}>Pending Amount</Text><Text style={{ fontWeight: '900', color: C.text }}>{rupee(balDue)}</Text></View>
              </>
            )}

            {adv > 0 && refDue > 0 && (
              <View style={[s.togRow, { borderTopWidth: 1, borderTopColor: C.border, marginTop: 10, paddingTop: 10 }]}>
                <Text style={s.togLabel}>Refund Returned to Customer</Text>
                <Switch value={b.advanceReturned || false} onValueChange={(val) => save({ advanceReturned: val })} trackColor={{ false: '#D7CCC8', true: C.green }} thumbColor="#fff" />
              </View>
            )}
          </View>
        )}

        {/* ═══ SIMPLIFIED STATUS TOGGLES ═══ */}
        <View style={s.card}>
          <Text style={s.secH}>📋 {t.actions}</Text>
          
          <View style={s.statusRow}>
            <View style={s.statusLeft}>
              <Text style={s.statusIcon}>📦</Text>
              <View>
                <Text style={s.statusLabel}>{t.items}</Text>
                <Text style={[s.statusValue, { color: b.returned ? C.green : C.orange }]}>
                  {b.returned ? t.returned + ' ✓' : t.active}
                </Text>
              </View>
            </View>
            <Switch
              value={b.returned}
              onValueChange={toggleReturned}
              trackColor={{ false: '#FFE0B2', true: C.greenLight }}
              thumbColor={b.returned ? C.green : C.orange}
              style={{ transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
            />
          </View>

          <View style={s.divider} />

            <View style={s.statusRow}>
              <View style={s.statusLeft}>
                <Text style={s.statusIcon}>💰</Text>
                <View>
                  <Text style={s.statusLabel}>{t.paid}/{t.unpaid}</Text>
                  <Text style={[s.statusValue, { color: isPaid ? C.green : C.red }]}>
                    {isPaid ? t.paid + ' ✓' : t.unpaid}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={[s.saveCalcBtn, { marginTop: 0, padding: 8, backgroundColor: C.blue }]} onPress={handleUpdateAdv}>
                <Text style={s.saveCalcTxt}>Receive Payment</Text>
              </TouchableOpacity>
            </View>

            {!isPaid && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity style={[s.reminderLink, { flex: 1, paddingLeft: 0 }]} onPress={sendReminder}>
                  <Ionicons name="notifications-outline" size={14} color={C.orange} />
                  <Text style={[s.reminderTxt, { flexShrink: 1 }]} numberOfLines={2}>{t.remind} →</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveCalcBtn, { marginTop: 0, padding: 8 }]} onPress={handleUpdateAdv}>
                  <Text style={s.saveCalcTxt}>Update Payment</Text>
                </TouchableOpacity>
              </View>
            )}

          <View style={s.divider} />

          <TouchableOpacity style={s.dmgLink} onPress={() => setShowDmg(true)}>
            <Ionicons name="warning-outline" size={14} color={C.orange} />
            <Text style={s.dmgLinkTxt}>{t.addDmg}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.shareRow}>
          <TouchableOpacity style={[s.shareBtn, { backgroundColor: '#25D366' }]} onPress={shareWA}>
            <Ionicons name="logo-whatsapp" size={16} color="#fff" /><Text style={s.shareTxt}>{t.waInv}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.shareBtn, { backgroundColor: C.blue }]} onPress={() => setShowAdminModal(true)}>
            <Ionicons name="download-outline" size={16} color="#fff" /><Text style={s.shareTxt}>{t.dlPdf}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Damage Modal */}
      <Modal visible={showDmg} transparent animationType="slide">
        <View style={s.modalBg}><View style={s.sheet}>
          <View style={s.shHandle} />
          <Text style={s.shTitle}>⚠️ {t.addDmg}</Text>
          <Text style={s.label}>Select Item</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {(b.items || []).map((it, idx) => (
              <TouchableOpacity key={idx} style={[s.chip, dmgForm.product === it.name && s.chipOn]} onPress={() => setDmgForm(p => ({ ...p, product: it.name }))}>
                <Text style={[s.chipTxt, dmgForm.product === it.name && s.chipTxtOn]}>{it.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Text style={s.label}>{t.dmgQty}</Text><TextInput style={s.input} keyboardType="number-pad" placeholder="2" value={dmgForm.qty} onChangeText={v => setDmgForm(p => ({ ...p, qty: v }))} placeholderTextColor={C.textMuted} /></View>
            <View style={{ flex: 1 }}><Text style={s.label}>{t.dmgRate}</Text><TextInput style={s.input} keyboardType="number-pad" placeholder="100" value={dmgForm.rate} onChangeText={v => setDmgForm(p => ({ ...p, rate: v }))} placeholderTextColor={C.textMuted} /></View>
          </View>
          {dmgForm.qty && dmgForm.rate ? <View style={s.dmgPreview}><Text style={{ color: C.primary, fontWeight: '700' }}>{t.dmgAmt}: {rupee((+dmgForm.qty) * (+dmgForm.rate))}</Text></View> : null}
          <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.red }]} onPress={handleAddDmg}><Text style={s.saveBtnTxt}>+ {t.addDmg}</Text></TouchableOpacity>
          <TouchableOpacity style={{ padding: 12, alignItems: 'center' }} onPress={() => setShowDmg(false)}><Text style={{ color: C.textMuted }}>{t.cancel}</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* Admin Signature Modal */}
      <Modal visible={showAdminModal} transparent animationType="fade">
        <View style={[s.modalBg, { justifyContent: 'center', padding: 20 }]}>
          <View style={[s.sheet, { borderRadius: 16 }]}>
             <Text style={s.shTitle}>Select Admin to Sign Bill</Text>
             <Text style={[s.label, { marginBottom: 12 }]}>Choose the admin generating this invoice so their signature will appear.</Text>
             
             <TouchableOpacity style={s.adminOpt} onPress={() => generatePDFWithAdmin(store?.ownerName, store?.createdBySignature)}>
               <View style={s.adminOptLeft}>
                 <Ionicons name="person" size={20} color={C.primary} />
                 <Text style={s.adminOptName}>{store?.ownerName} (Owner)</Text>
               </View>
               {store?.createdBySignature ? <Ionicons name="checkmark-circle" size={20} color={C.green} /> : null}
             </TouchableOpacity>

             <FlatList
               data={members}
               keyExtractor={item => item.id}
               renderItem={({ item }) => (
                 <TouchableOpacity style={s.adminOpt} onPress={() => generatePDFWithAdmin(item.name, item.signature)}>
                   <View style={s.adminOptLeft}>
                     <Ionicons name="person" size={20} color={C.textMuted} />
                     <Text style={s.adminOptName}>{item.name}</Text>
                   </View>
                   {item.signature ? <Ionicons name="checkmark-circle" size={20} color={C.green} /> : null}
                 </TouchableOpacity>
               )}
               style={{ maxHeight: 200 }}
             />
             
             <TouchableOpacity style={{ padding: 12, alignItems: 'center', marginTop: 10 }} onPress={() => setShowAdminModal(false)}>
                <Text style={{ color: C.red, fontWeight: '700' }}>{t.cancel}</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const useStyles = (C) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.primary, paddingTop: 48, paddingBottom: 12, paddingHorizontal: 14 },
  hTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  delBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  delBtnTxt: { fontSize: 11, fontWeight: '700', color: C.red },
  body: { flex: 1, padding: 12 },

  hero: { backgroundColor: C.primary, borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 10 },
  heroAv: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  heroAvTxt: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroPhone: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  heroEvent: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },

  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  secH: { fontSize: 14, fontWeight: '800', marginBottom: 10, color: C.text },
  label: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', marginTop: 8, marginBottom: 3 },
  input: { backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 11, fontSize: 14, color: C.text },

  dateBox: { backgroundColor: C.inputBg, borderRadius: 10, padding: 11, borderWidth: 1.5, borderColor: C.border },
  dateTxt: { fontSize: 13, fontWeight: '600', color: C.text },
  dayChip: { backgroundColor: C.primary, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 5, alignSelf: 'flex-start', marginTop: 8 },
  dayChipTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },

  togRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginTop: 4 },
  togLabel: { fontSize: 13, fontWeight: '600', color: C.text },

  saveCalcBtn: { backgroundColor: C.primary + '15', borderRadius: 10, padding: 11, alignItems: 'center', marginTop: 10 },
  saveCalcTxt: { color: C.primary, fontWeight: '700', fontSize: 14 },

  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  itemImg: { width: 30, height: 30, borderRadius: 8 },
  itemNoImg: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontWeight: '700', fontSize: 14, color: C.text },
  itemCalc: { fontSize: 11, color: C.textMuted },
  itemAmt: { fontWeight: '800', fontSize: 14, color: C.text },

  billRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  billTxt: { fontSize: 13, color: C.text },
  billTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: C.primary, marginTop: 6, paddingTop: 10 },
  billTotalTxt: { fontSize: 20, fontWeight: '900', color: C.primary },

  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIcon: { fontSize: 24 },
  statusLabel: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  statusValue: { fontSize: 15, fontWeight: '800' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 2 },

  reminderLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8 },
  reminderTxt: { fontSize: 13, color: C.orange, fontWeight: '600' },

  dmgLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10 },
  dmgLinkTxt: { fontSize: 13, color: C.orange, fontWeight: '600', flexShrink: 1 },

  shareRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 12, borderRadius: 12 },
  shareTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },

  dmgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.redLight },
  dmgName: { fontWeight: '700', fontSize: 13, color: C.red },
  dmgCalc: { fontSize: 11, color: C.textMuted },
  dmgAmt: { fontWeight: '800', color: C.red, fontSize: 14 },
  dmgPreview: { backgroundColor: C.primary + '15', borderRadius: 8, padding: 10, marginVertical: 8, alignItems: 'center' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18 },
  shHandle: { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  shTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, color: C.text },
  saveBtn: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 },
  saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },

  adminOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginBottom: 8 },
  adminOptLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adminOptName: { fontSize: 14, fontWeight: '700', color: C.text }
});
