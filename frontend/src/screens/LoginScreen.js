import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator
} from 'react-native';
import { useTheme } from '../utils/ThemeContext';
import { T } from '../utils/lang';
import { login, register, resetPassword } from '../utils/api';

export default function LoginScreen({ onLogin }) {
  const { theme: C } = useTheme();
  const s = useStyles(C);

  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [lang, setLang] = useState('en');     // UI language for this screen
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields — separate for login and register to avoid confusion
  const [loginForm, setLoginForm] = useState({ mobile: '', password: '' });
  const [regForm, setRegForm] = useState({ storeName: '', ownerName: '', mobile: '', password: '', address: '' });
  const [forgotForm, setForgotForm] = useState({ mobile: '', ownerName: '', newPassword: '' });

  const t = T[lang]; // current language translations

  // Validation
  const validateLogin = () => {
    if (!loginForm.mobile || !loginForm.password) return t.allReq;
    if (loginForm.mobile.length !== 10) return lang === 'ta' ? '10 இலக்க மொபைல் எண் தேவை' : 'Enter valid 10-digit mobile';
    return null;
  };

  const validateRegister = () => {
    if (!regForm.storeName || !regForm.ownerName || !regForm.mobile || !regForm.password) return t.allReq;
    if (regForm.mobile.length !== 10) return lang === 'ta' ? '10 இலக்க மொபைல் எண் தேவை' : 'Enter valid 10-digit mobile';
    if (regForm.password.length < 4) return lang === 'ta' ? 'கடவுச்சொல் 4+ எழுத்துகள்' : 'Password must be 4+ characters';
    return null;
  };

  const handleLogin = async () => {
    setError('');
    const err = validateLogin();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const res = await login({
        mobile: loginForm.mobile,
        password: loginForm.password,
      });

      if (res.data?.token && res.data?.store) {
        onLogin(res.data.token, res.data.store);
      } else {
        setError(t.inv);
      }
    } catch (e) {
      const msg = e.response?.data?.error;
      if (msg) setError(msg);
      else if (e.message?.includes('Network')) setError(lang === 'ta' ? 'இணைய இணைப்பு பிழை' : 'Network error. Check connection.');
      else setError(t.inv);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    const err = validateRegister();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const res = await register({
        storeName: regForm.storeName,
        ownerName: regForm.ownerName,
        mobile: regForm.mobile,
        password: regForm.password,
        address: regForm.address || '',
        lang: lang, // Save selected language to DB
      });

      if (res.data?.token && res.data?.store) {
        onLogin(res.data.token, res.data.store);
      } else {
        setError(lang === 'ta' ? 'பதிவு தோல்வி' : 'Registration failed');
      }
    } catch (e) {
      const msg = e.response?.data?.error;
      if (msg) {
        // Translate common errors
        if (msg.includes('already registered')) {
          setError(t.mobEx);
        } else {
          setError(msg);
        }
      } else if (e.message?.includes('Network')) {
        setError(lang === 'ta' ? 'சர்வர் இணைப்பு தோல்வி' : 'Cannot connect to server');
      } else {
        setError(lang === 'ta' ? 'ஏதோ தவறு ஏற்பட்டது' : 'Something went wrong');
      }
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    setError('');
    if (!forgotForm.mobile || !forgotForm.ownerName || !forgotForm.newPassword) {
      setError(t.allReq); return;
    }
    if (forgotForm.mobile.length !== 10) {
      setError(lang === 'ta' ? '10 இலக்க மொபைல் எண் தேவை' : 'Enter valid 10-digit mobile'); return;
    }
    if (forgotForm.newPassword.length < 4) {
      setError(lang === 'ta' ? 'கடவுச்சொல் 4+ எழுத்துகள்' : 'Password must be 4+ characters'); return;
    }

    setLoading(true);
    try {
      await resetPassword(forgotForm);
      Alert.alert('Success', lang === 'ta' ? 'கடவுச்சொல் மாற்றப்பட்டது!' : 'Password updated successfully!');
      setMode('login');
      setLoginForm({ mobile: forgotForm.mobile, password: '' });
      setForgotForm({ mobile: '', ownerName: '', newPassword: '' });
    } catch (e) {
      const msg = e.response?.data?.error;
      if (msg) setError(msg);
      else setError('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Switch mode and clear errors
  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
  };

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Brand Logo */}
        <View style={s.brand}>
          <Image source={require('../../assets/icon.png')} style={s.logo} />
          <Text style={s.brandName}>Kalyan Store</Text>
          <Text style={s.brandSub}>Rental Management</Text>
        </View>

        <View style={s.card}>

          {/* Login / Register tabs */}
          {mode !== 'forgot' ? (
            <View style={s.tabs}>
              <TouchableOpacity style={[s.tab, mode === 'login' && s.tabOn]} onPress={() => switchMode('login')}>
                <Text style={[s.tabTxt, mode === 'login' && s.tabTxtOn]}>{t.login}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.tab, mode === 'register' && s.tabOn]} onPress={() => switchMode('register')}>
                <Text style={[s.tabTxt, mode === 'register' && s.tabTxtOn]}>{t.register}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.tabs}>
              <TouchableOpacity style={[s.tab, s.tabOn]} activeOpacity={1}>
                <Text style={[s.tabTxt, s.tabTxtOn]}>{lang === 'ta' ? 'கடவுச்சொல் மீட்டமை' : 'Reset Password'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Language selector — always visible */}
          <Text style={s.label}>{t.lang}</Text>
          <View style={s.langRow}>
            <TouchableOpacity style={[s.langBtn, lang === 'en' && s.langOn]} onPress={() => setLang('en')}>
              <Text style={[s.langTxt, lang === 'en' && s.langTxtOn]}>🇬🇧 English</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.langBtn, lang === 'ta' && s.langOn]} onPress={() => setLang('ta')}>
              <Text style={[s.langTxt, lang === 'ta' && s.langTxtOn]}>🇮🇳 தமிழ்</Text>
            </TouchableOpacity>
          </View>

          {/* ═══ REGISTER FORM ═══ */}
          {mode === 'register' && (
            <>
              <Text style={s.label}>{t.storeName} *</Text>
              <TextInput
                style={s.input}
                placeholder={lang === 'ta' ? 'உங்கள் கடை பெயர்' : 'Your store name'}
                value={regForm.storeName}
                onChangeText={v => setRegForm(p => ({ ...p, storeName: v }))}
                autoCapitalize="words"
                placeholderTextColor={C.textMuted}
              />

              <Text style={s.label}>{t.ownerName} *</Text>
              <TextInput
                style={s.input}
                placeholder={lang === 'ta' ? 'உங்கள் பெயர்' : 'Your full name'}
                value={regForm.ownerName}
                onChangeText={v => setRegForm(p => ({ ...p, ownerName: v }))}
                autoCapitalize="words"
                placeholderTextColor={C.textMuted}
              />

              <Text style={s.label}>{t.address}</Text>
              <TextInput
                style={s.input}
                placeholder={lang === 'ta' ? 'கடை முகவரி (விருப்பம்)' : 'Shop address (optional)'}
                value={regForm.address}
                onChangeText={v => setRegForm(p => ({ ...p, address: v }))}
                placeholderTextColor={C.textMuted}
              />

              <Text style={s.label}>{t.mobile} *</Text>
              <TextInput
                style={s.input}
                placeholder="9876543210"
                keyboardType="phone-pad"
                maxLength={10}
                value={regForm.mobile}
                onChangeText={v => setRegForm(p => ({ ...p, mobile: v.replace(/\D/g, '') }))}
                placeholderTextColor={C.textMuted}
              />

              <Text style={s.label}>{t.password} *</Text>
              <TextInput
                style={s.input}
                placeholder={lang === 'ta' ? 'குறைந்தது 4 எழுத்துகள்' : 'Minimum 4 characters'}
                secureTextEntry
                value={regForm.password}
                onChangeText={v => setRegForm(p => ({ ...p, password: v }))}
                placeholderTextColor={C.textMuted}
              />
            </>
          )}

          {/* ═══ LOGIN FORM ═══ */}
          {mode === 'login' && (
            <>
              <Text style={s.label}>{t.mobile} *</Text>
              <TextInput
                style={s.input}
                placeholder="9876543210"
                keyboardType="phone-pad"
                maxLength={10}
                value={loginForm.mobile}
                onChangeText={v => setLoginForm(p => ({ ...p, mobile: v.replace(/\D/g, '') }))}
                placeholderTextColor={C.textMuted}
              />

              <Text style={s.label}>{t.password} *</Text>
              <TextInput
                style={s.input}
                placeholder="••••••"
                secureTextEntry
                value={loginForm.password}
                onChangeText={v => setLoginForm(p => ({ ...p, password: v }))}
                onSubmitEditing={handleLogin}
                returnKeyType="go"
                placeholderTextColor={C.textMuted}
              />
              <TouchableOpacity onPress={() => switchMode('forgot')} style={{ alignItems: 'flex-end', marginTop: 8 }}>
                <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>{lang === 'ta' ? 'கடவுச்சொல்லை மறந்துவிட்டீர்களா?' : 'Forgot Password?'}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ═══ FORGOT PASSWORD FORM ═══ */}
          {mode === 'forgot' && (
            <>
              <Text style={s.label}>{t.mobile} *</Text>
              <TextInput
                style={s.input}
                placeholder="9876543210"
                keyboardType="phone-pad"
                maxLength={10}
                value={forgotForm.mobile}
                onChangeText={v => setForgotForm(p => ({ ...p, mobile: v.replace(/\D/g, '') }))}
                placeholderTextColor={C.textMuted}
              />

              <Text style={s.label}>{t.ownerName} *</Text>
              <TextInput
                style={s.input}
                placeholder={lang === 'ta' ? 'உங்கள் பெயர் (சரியாக)' : 'Owner Name (Exact match)'}
                value={forgotForm.ownerName}
                onChangeText={v => setForgotForm(p => ({ ...p, ownerName: v }))}
                autoCapitalize="words"
                placeholderTextColor={C.textMuted}
              />

              <Text style={s.label}>{lang === 'ta' ? 'புதிய கடவுச்சொல்' : 'New Password'} *</Text>
              <TextInput
                style={s.input}
                placeholder={lang === 'ta' ? 'குறைந்தது 4 எழுத்துகள்' : 'Minimum 4 characters'}
                secureTextEntry
                value={forgotForm.newPassword}
                onChangeText={v => setForgotForm(p => ({ ...p, newPassword: v }))}
                onSubmitEditing={handleForgot}
                returnKeyType="go"
                placeholderTextColor={C.textMuted}
              />
            </>
          )}

          {/* Error message */}
          {error !== '' && (
            <View style={s.errBox}>
              <Text style={s.errTxt}>⚠️ {error}</Text>
            </View>
          )}

          {/* Submit button */}
          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleForgot}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnTxt}>
                {mode === 'login' ? t.loginBtn : mode === 'register' ? t.registerBtn : (lang === 'ta' ? 'கடவுச்சொல் மாற்று' : 'Update Password')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Switch mode hint */}
          {mode !== 'forgot' ? (
            <TouchableOpacity style={s.switchHint} onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              <Text style={s.switchTxt}>
                {mode === 'login'
                  ? (lang === 'ta' ? 'புதிய கணக்கு? பதிவு செய்யவும்' : 'New here? Create an account')
                  : (lang === 'ta' ? 'ஏற்கனவே கணக்கு உள்ளதா? உள்நுழையவும்' : 'Already have an account? Login')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.switchHint} onPress={() => switchMode('login')}>
              <Text style={s.switchTxt}>{lang === 'ta' ? 'உள்நுழைய திரும்பவும்' : 'Back to Login'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = (C) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  brand: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 90, height: 90, borderRadius: 22, marginBottom: 10 },
  brandName: { fontSize: 30, fontWeight: '900', color: C.primary },
  brandSub: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  tabs: { flexDirection: 'row', backgroundColor: C.inputBg, borderRadius: 12, padding: 3, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  tabTxt: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  tabTxtOn: { color: '#fff' },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  langBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: C.border, alignItems: 'center', backgroundColor: C.card },
  langOn: { borderColor: C.primary, backgroundColor: C.primary + '15' },
  langTxt: { fontSize: 14, fontWeight: '700', color: C.textMuted },
  langTxtOn: { color: C.primary },
  label: { fontSize: 11, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 13, fontSize: 15, marginBottom: 4, color: C.text },
  errBox: { backgroundColor: C.redLight, borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#FFCDD2' },
  errTxt: { color: C.red, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  btn: { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16, shadowColor: C.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  switchHint: { paddingVertical: 14, alignItems: 'center' },
  switchTxt: { fontSize: 13, color: C.primary, fontWeight: '600' },
});
