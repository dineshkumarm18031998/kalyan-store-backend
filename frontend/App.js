import React, { useState, useEffect, createContext, useContext } from 'react';
import { View, ActivityIndicator, Image, Text, StyleSheet, AsyncStorage as RNAsync } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import OrderScreen from './src/screens/OrderScreen';
import DetailsScreen from './src/screens/DetailsScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { T } from './src/utils/lang';
import { ThemeProvider, useTheme } from './src/utils/ThemeContext';

import { AppContext, useApp } from './src/utils/AppContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function DetailStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DetailsList" component={DetailsScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { t } = useApp();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 4, height: 60 + Math.max(insets.bottom, 0) },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarIcon: ({ focused, color }) => {
          const icons = { Home: focused ? 'home' : 'home-outline', Products: focused ? 'cube' : 'cube-outline', Order: focused ? 'bag-add' : 'bag-add-outline', Details: focused ? 'document-text' : 'document-text-outline', History: focused ? 'time' : 'time-outline' };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t.home }} />
      <Tab.Screen name="Products" component={ProductsScreen} options={{ tabBarLabel: t.products }} />
      <Tab.Screen name="Order" component={OrderScreen} options={{ tabBarLabel: t.order }} />
      <Tab.Screen name="Details" component={DetailStack} options={{ tabBarLabel: t.details }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: t.history }} />
    </Tab.Navigator>
  );
}

const AppStack = createNativeStackNavigator();
function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="MainTabs" component={MainTabs} />
      <AppStack.Screen name="Profile" component={ProfileScreen} />
    </AppStack.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#F8F4EF', alignItems: 'center', justifyContent: 'center' }}>
      <Image source={require('./assets/icon.png')} style={{ width: 100, height: 100, borderRadius: 24, marginBottom: 12 }} />
      <Text style={{ fontSize: 26, fontWeight: '900', color: '#D84315' }}>Kalyan Store</Text>
      <ActivityIndicator size="large" color="#D84315" style={{ marginTop: 20 }} />
    </View>
  );
}

export default function App() {
  const [store, setStore] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await AsyncStorage.getItem('token');
        const savedStore = await AsyncStorage.getItem('store');
        if (savedToken && savedStore) {
          setToken(savedToken);
          setStore(JSON.parse(savedStore));
        }
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  const handleLogin = async (tokenVal, storeVal) => {
    try {
      setToken(tokenVal);
      setStore(storeVal);
      await AsyncStorage.setItem('token', tokenVal);
      await AsyncStorage.setItem('store', JSON.stringify(storeVal));
    } catch (e) {}
  };

  const handleLogout = async () => {
    try {
      setToken(null);
      setStore(null);
      setProducts([]);
      setBookings([]);
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('store');
    } catch (e) {}
  };

  if (loading) return <SplashScreen />;

  const lang = store?.lang || 'en';
  const t = T[lang];

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContext.Provider value={{ store, setStore, token, t, lang, products, setProducts, bookings, setBookings, logout: handleLogout }}>
          <StatusBar style="light" />
          <NavigationContainer>
            {!token ? (
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Login">{(props) => <LoginScreen {...props} onLogin={handleLogin} />}</Stack.Screen>
              </Stack.Navigator>
            ) : (
              <AppNavigator />
            )}
          </NavigationContainer>
        </AppContext.Provider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
