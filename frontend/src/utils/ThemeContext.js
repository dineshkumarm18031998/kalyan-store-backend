import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

export const themes = {
  Terracotta: {
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
  },
  Emerald: {
    primary: '#10B981',
    primaryDark: '#047857',
    primaryLight: '#34D399',
    green: '#2E7D32',
    greenLight: '#E8F5E9',
    red: '#EF4444',
    redLight: '#FEE2E2',
    blue: '#3B82F6',
    blueLight: '#DBEAFE',
    orange: '#F59E0B',
    orangeLight: '#FEF3C7',
    yellow: '#FBBF24',
    teal: '#14B8A6',
    tealLight: '#CCFBF1',
    whatsapp: '#25D366',
    bg: '#F0FDF4',
    card: '#FFFFFF',
    border: '#D1FAE5',
    text: '#064E3B',
    textMuted: '#047857',
    inputBg: '#ECFDF5',
  },
  Indigo: {
    primary: '#6366F1',
    primaryDark: '#4338CA',
    primaryLight: '#818CF8',
    green: '#10B981',
    greenLight: '#D1FAE5',
    red: '#EF4444',
    redLight: '#FEE2E2',
    blue: '#3B82F6',
    blueLight: '#DBEAFE',
    orange: '#F59E0B',
    orangeLight: '#FEF3C7',
    yellow: '#FBBF24',
    teal: '#14B8A6',
    tealLight: '#CCFBF1',
    whatsapp: '#25D366',
    bg: '#EEF2FF',
    card: '#FFFFFF',
    border: '#E0E7FF',
    text: '#312E81',
    textMuted: '#4F46E5',
    inputBg: '#F5F3FF',
  },
  DarkMode: {
    primary: '#F97316',
    primaryDark: '#EA580C',
    primaryLight: '#FDBA74',
    green: '#4ADE80',
    greenLight: '#14532D',
    red: '#F87171',
    redLight: '#7F1D1D',
    blue: '#60A5FA',
    blueLight: '#1E3A8A',
    orange: '#FBBF24',
    orangeLight: '#78350F',
    yellow: '#FDE047',
    teal: '#2DD4BF',
    tealLight: '#134E4A',
    whatsapp: '#22C55E',
    bg: '#111827',
    card: '#1F2937',
    border: '#374151',
    text: '#F9FAFB',
    textMuted: '#9CA3AF',
    inputBg: '#374151',
  }
};

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState('Terracotta');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('theme').then(savedTheme => {
      if (savedTheme && themes[savedTheme]) {
        setThemeName(savedTheme);
      }
      setLoading(false);
    });
  }, []);

  const changeTheme = async (name) => {
    setThemeName(name);
    await AsyncStorage.setItem('theme', name);
  };

  if (loading) return null;

  return (
    <ThemeContext.Provider value={{ theme: themes[themeName], themeName, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
