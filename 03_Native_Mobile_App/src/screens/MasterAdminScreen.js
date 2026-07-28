import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE } from '../config';

export default function MasterAdminScreen({ token }) {
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const [usersRes, sessionsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/admin/users`, { headers }),
        fetch(`${API_BASE}/admin/sessions`, { headers }),
        fetch(`${API_BASE}/admin/history`, { headers })
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
    } catch (err) {
      Alert.alert('Admin Access Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Active Now';
    try {
      const formatted = String(dateStr).replace(' ', 'T');
      const d = new Date(formatted);
      return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleString();
    } catch (e) {
      return String(dateStr);
    }
  };

  const handleToggleUserStatus = async (user) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user.id}/toggle-status`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Could not update user status');
      }
      Alert.alert('Status Updated', `Analyst '${user.username}' status has been updated.`);
      fetchAdminData();
    } catch (err) {
      Alert.alert('Action Error', err.message);
    }
  };

  const handleDeleteUser = (user) => {
    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to permanently erase analyst account '${user.username}'?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase User',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE}/admin/users/${user.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Could not erase user');
              }
              Alert.alert('User Erased', `Analyst '${user.username}' has been deleted.`);
              fetchAdminData();
            } catch (err) {
              Alert.alert('Deletion Error', err.message);
            }
          }
        }
      ]
    );
  };

  const handleExportAdminCSV = async (type) => {
    try {
      let endpoint = '';
      let filename = '';
      if (type === 'users') {
        endpoint = '/admin/export/users';
        filename = 'Apex_Users_Export.csv';
      } else if (type === 'sessions') {
        endpoint = '/admin/export/sessions';
        filename = 'Apex_Sessions_Export.csv';
      } else {
        endpoint = '/admin/export/history';
        filename = 'Apex_Audit_History_Export.csv';
      }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('CSV Export failed');

      const csvData = await res.text();
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, csvData, {
        encoding: FileSystem.EncodingType.UTF8
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${filename}`,
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('CSV Created', `File saved at:\n${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Export Error', err.message);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#818cf8" />
        <Text style={styles.loadingText}>Authenticating Master Admin Privileges...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerBox}>
        <Text style={styles.headerTitle}>🛡️ Master Admin Control Panel</Text>
        <Text style={styles.headerSub}>Enterprise Security & User Privilege Management</Text>

        {/* Admin Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'users' && styles.tabBtnActive]}
            onPress={() => setActiveTab('users')}
          >
            <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
              👥 Analysts ({users.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'sessions' && styles.tabBtnActive]}
            onPress={() => setActiveTab('sessions')}
          >
            <Text style={[styles.tabText, activeTab === 'sessions' && styles.tabTextActive]}>
              ⏱️ Sessions ({sessions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              📜 Audit ({history.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab 1: Analysts & Users List */}
      {activeTab === 'users' && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Registered Analyst Accounts</Text>
            <TouchableOpacity style={styles.csvBtn} onPress={() => handleExportAdminCSV('users')}>
              <Text style={styles.csvBtnText}>📥 Users CSV</Text>
            </TouchableOpacity>
          </View>

          {users.map((u) => (
            <View key={u.id} style={styles.userCard}>
              <View style={styles.userInfoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{u.username}</Text>
                  <Text style={styles.itemSub}>ID: #{u.id} • Registered: {formatDate(u.created_at)}</Text>
                </View>
                <View style={[styles.badge, u.is_master ? styles.badgeMaster : u.is_active !== false ? styles.badgeActive : styles.badgeDisabled]}>
                  <Text style={styles.badgeText}>
                    {u.is_master ? 'MASTER' : u.is_active !== false ? 'ACTIVE' : 'DISABLED'}
                  </Text>
                </View>
              </View>

              {/* Action Control Buttons (Disable / Delete) */}
              {!u.is_master && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, u.is_active !== false ? styles.disableBtn : styles.enableBtn]}
                    onPress={() => handleToggleUserStatus(u)}
                  >
                    <Text style={styles.actionBtnText}>
                      {u.is_active !== false ? '⏸️ Disable' : '▶️ Enable'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDeleteUser(u)}
                  >
                    <Text style={styles.actionBtnText}>🗑️ Erase Account</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Tab 2: User Sessions Log */}
      {activeTab === 'sessions' && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Login & Session Activity Log</Text>
            <TouchableOpacity style={styles.csvBtn} onPress={() => handleExportAdminCSV('sessions')}>
              <Text style={styles.csvBtnText}>📥 Sessions CSV</Text>
            </TouchableOpacity>
          </View>

          {sessions.map((s) => (
            <View key={s.id} style={styles.itemRow}>
              <View>
                <Text style={styles.itemTitle}>Session #{s.id} • User #{s.user_id}</Text>
                <Text style={styles.itemSub}>Login: {formatDate(s.login_time)}</Text>
                {s.logout_time ? (
                  <Text style={[styles.itemSub, { color: '#94a3b8' }]}>
                    Logout: {formatDate(s.logout_time)}
                  </Text>
                ) : (
                  <Text style={[styles.itemSub, { color: '#10b981', fontWeight: '700' }]}>
                    🟢 ACTIVE SESSION
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Tab 3: System Prediction Audit History */}
      {activeTab === 'history' && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>System Underwriting Audit History</Text>
            <TouchableOpacity style={styles.csvBtn} onPress={() => handleExportAdminCSV('history')}>
              <Text style={styles.csvBtnText}>📥 History CSV</Text>
            </TouchableOpacity>
          </View>

          {history.map((h) => (
            <View key={h.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>₹{h.loan_amount?.toLocaleString('en-IN')} Request</Text>
                <Text style={styles.itemSub}>
                  Income: ₹{h.applicant_income?.toLocaleString('en-IN')} • Tenure: {h.loan_amount_term}m • User #{h.user_id}
                </Text>
                <Text style={[styles.itemSub, { color: '#64748b' }]}>{formatDate(h.created_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[
                  styles.historyStatus,
                  h.prediction_result === 'Approved' ? { color: '#10b981' } :
                  h.prediction_result === 'Counter-Offer Proposed' ? { color: '#c9922a' } : { color: '#ef4444' }
                ]}>
                  {h.prediction_result}
                </Text>
                <Text style={styles.itemSub}>{h.confidence_score}% score</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 13
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  headerBox: {
    marginBottom: 16
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#818cf8'
  },
  headerSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 14
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 4,
    gap: 4
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8
  },
  tabBtnActive: {
    backgroundColor: '#4f46e5'
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8'
  },
  tabTextActive: {
    color: '#ffffff'
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff'
  },
  csvBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  csvBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  userCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  userInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)'
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff'
  },
  itemSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  badgeMaster: {
    backgroundColor: 'rgba(129, 140, 248, 0.2)'
  },
  badgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)'
  },
  badgeDisabled: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)'
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center'
  },
  disableBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  enableBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981'
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff'
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: '700'
  }
});
