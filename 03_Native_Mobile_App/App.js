import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthScreen from './src/screens/AuthScreen';
import UnderwritingScreen from './src/screens/UnderwritingScreen';
import AmortizationScreen from './src/screens/AmortizationScreen';
import PortfolioScreen from './src/screens/PortfolioScreen';
import MasterAdminScreen from './src/screens/MasterAdminScreen';

export default function App() {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [isMaster, setIsMaster] = useState(false);
  const [activeTab, setActiveTab] = useState('intake');
  const [simParams, setSimParams] = useState({ amount: 150000, termYears: 30 });
  const [loadingApp, setLoadingApp] = useState(true);

  useEffect(() => {
    checkSavedSession();
  }, []);

  const checkSavedSession = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('apex_token');
      const savedUser = await AsyncStorage.getItem('apex_user');
      const savedIsMaster = await AsyncStorage.getItem('apex_is_master');
      if (savedToken) {
        setToken(savedToken);
        setUsername(savedUser || 'Analyst');
        setIsMaster(savedIsMaster === 'true' || savedIsMaster === '1');
      }
    } catch (e) {
      console.log('Session check error:', e);
    } finally {
      setLoadingApp(false);
    }
  };

  const handleLoginSuccess = (newToken, newUsername, masterFlag) => {
    setToken(newToken);
    setUsername(newUsername);
    setIsMaster(Boolean(masterFlag));
    setActiveTab('intake');
  };

  const handleLogoutPress = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to end your analyst session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: performLogout
        }
      ]
    );
  };

  const performLogout = async () => {
    await AsyncStorage.multiRemove(['apex_token', 'apex_user', 'apex_session', 'apex_is_master']);
    setToken(null);
    setUsername('');
    setIsMaster(false);
    setActiveTab('intake');
  };

  const handleSwitchToAmortization = (amount, termYears) => {
    setSimParams({ amount, termYears });
    setActiveTab('simulator');
  };

  if (loadingApp) {
    return (
      <View style={styles.splashContainer}>
        <Text style={styles.splashTitle}>Apex Credit Systems</Text>
      </View>
    );
  }

  if (!token) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Top Header Bar */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.logoText}>Apex Credit</Text>
          <View style={styles.userBadge}>
            <Text style={styles.userBadgeText}>
              {isMaster ? '🛡️ MASTER' : '👤'} {username}
            </Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, activeTab === 'intake' && styles.navBtnActive]}
            onPress={() => setActiveTab('intake')}
          >
            <Text style={[styles.navText, activeTab === 'intake' && styles.navTextActive]}>
              🏦 Intake
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, activeTab === 'portfolio' && styles.navBtnActive]}
            onPress={() => setActiveTab('portfolio')}
          >
            <Text style={[styles.navText, activeTab === 'portfolio' && styles.navTextActive]}>
              📊 Portfolio
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, activeTab === 'simulator' && styles.navBtnActive]}
            onPress={() => setActiveTab('simulator')}
          >
            <Text style={[styles.navText, activeTab === 'simulator' && styles.navTextActive]}>
              🧮 Simulator
            </Text>
          </TouchableOpacity>

          {isMaster && (
            <TouchableOpacity
              style={[styles.navBtn, activeTab === 'admin' && styles.navBtnActive]}
              onPress={() => setActiveTab('admin')}
            >
              <Text style={[styles.navText, activeTab === 'admin' && styles.navTextActive]}>
                🛡️ Admin
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogoutPress}>
            <Text style={styles.logoutText}>🔒</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body Screen View */}
      <View style={styles.body}>
        {activeTab === 'intake' && (
          <UnderwritingScreen
            token={token}
            onSwitchToAmortization={handleSwitchToAmortization}
          />
        )}
        {activeTab === 'portfolio' && <PortfolioScreen token={token} />}
        {activeTab === 'simulator' && (
          <AmortizationScreen
            initialAmount={simParams.amount}
            initialTermYears={simParams.termYears}
          />
        )}
        {activeTab === 'admin' && <MasterAdminScreen token={token} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center'
  },
  splashTitle: {
    color: '#818cf8',
    fontSize: 24,
    fontWeight: '800'
  },
  header: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)'
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#818cf8',
    letterSpacing: -0.5
  },
  userBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)'
  },
  userBadgeText: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '700'
  },
  navRow: {
    flexDirection: 'row',
    gap: 4
  },
  navBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    alignItems: 'center'
  },
  navBtnActive: {
    backgroundColor: '#4f46e5'
  },
  navText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  navTextActive: {
    color: '#ffffff'
  },
  logoutBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8
  },
  logoutText: {
    fontSize: 13
  },
  body: {
    flex: 1
  }
});
