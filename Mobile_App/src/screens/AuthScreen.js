import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';

export default function AuthScreen({ onLoginSuccess }) {
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');



  const validatePasswordRequirements = (pass) => {
    return (
      pass.length >= 8 &&
      /[A-Z]/.test(pass) &&
      /[a-z]/.test(pass) &&
      /[0-9]/.test(pass) &&
      /[^A-Za-z0-9]/.test(pass) &&
      pass !== username
    );
  };


  const handleAuth = async () => {
    setErrorMessage('');
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both Analyst ID and Passcode.');
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'register') {
        if (!email.trim() || !email.includes('@')) {
          throw new Error('Please enter a valid professional email address.');
        }
        if (!validatePasswordRequirements(password)) {
          throw new Error('Passcode must be at least 8 chars, contain uppercase, lowercase, number, symbol, and not equal username.');
        }

        const res = await fetch(`${API_BASE}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email: email.trim(), password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Registration failed.');

        Alert.alert('Success', 'Credentials created securely! You may now login.');
        setAuthMode('login');
      } else {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const res = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Authentication failed.');

        await AsyncStorage.setItem('apex_token', data.access_token);
        await AsyncStorage.setItem('apex_user', username);
        await AsyncStorage.setItem('apex_session', String(data.session_id));
        await AsyncStorage.setItem('apex_is_master', String(data.is_master));

        onLoginSuccess(data.access_token, username, Boolean(data.is_master), data.session_id);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Apex Credit Systems</Text>
          <Text style={styles.subtitle}>Intelligent Underwriting Engine</Text>

          {/* Mode Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, authMode === 'login' && styles.tabBtnActive]}
              onPress={() => setAuthMode('login')}
            >
              <Text style={[styles.tabText, authMode === 'login' && styles.tabTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, authMode === 'register' && styles.tabBtnActive]}
              onPress={() => setAuthMode('register')}
            >
              <Text style={[styles.tabText, authMode === 'register' && styles.tabTextActive]}>Register</Text>
            </TouchableOpacity>
          </View>

          {/* Error Notice */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          ) : null}

          {/* Input Fields */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Analyst ID / Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. yash"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
          </View>

          {authMode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Professional Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@company.com"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                spellCheck={false}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Passcode</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={(text) => {
                  if (text.length > password.length + 1) {
                    Alert.alert('Security Warning', 'Pasting the password is not allowed for security reasons. Please type it manually.');
                    return;
                  }
                  setPassword(text);
                }}
                secureTextEntry={!showPassword}
                placeholder="Enter passcode"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                contextMenuHidden={true}
                selectTextOnFocus={false}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>



          {authMode === 'register' && (
            <View style={styles.reqBox}>
              <Text style={styles.reqTitle}>Passcode Security Requirements:</Text>
              <Text style={styles.reqItem}>• Min 8 characters</Text>
              <Text style={styles.reqItem}>• 1 Uppercase & 1 Lowercase letter</Text>
              <Text style={styles.reqItem}>• 1 Number & 1 Special symbol</Text>
              <Text style={styles.reqItem}>• Cannot match Analyst ID</Text>
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAuth} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {authMode === 'login' ? 'Authenticate Session' : 'Create Credentials'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNotice}>
            🔒 Protected by Apex Enterprise Multi-Factor Authentication
          </Text>
        </View>
      </ScrollView>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 8
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#818cf8',
    textAlign: 'center',
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 4
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  tabBtnActive: {
    backgroundColor: '#4f46e5'
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14
  },
  tabTextActive: {
    color: '#ffffff'
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center'
  },
  passwordInput: {
    paddingRight: 45
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 4
  },
  eyeText: {
    fontSize: 16
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 18
  },
  reqBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  reqTitle: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4
  },
  reqItem: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16
  },
  primaryBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  footerNotice: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#818cf8',
    marginBottom: 6,
    textAlign: 'center'
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 18
  },
  modalStatusBox: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1
  },
  modalStatusSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: '#22c55e'
  },
  modalStatusError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#ef4444'
  },
  modalStatusSuccessText: {
    color: '#4ade80',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center'
  },
  modalStatusErrorText: {
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center'
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#475569'
  },
  secondaryBtnText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600'
  }
});
