import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert
} from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const SCREEN_WIDTH = Dimensions.get('window').width - 32;

export default function AmortizationScreen({ initialAmount = 150000, initialTermYears = 30 }) {
  const [principalStr, setPrincipalStr] = useState(String(initialAmount));
  const [termYearsStr, setTermYearsStr] = useState(String(initialTermYears));
  const [aprStr, setAprStr] = useState('8.5');
  const [exporting, setExporting] = useState(false);

  const principal = parseFloat(principalStr) || 10000;
  const termYears = parseFloat(termYearsStr) || 1;
  const apr = parseFloat(aprStr) || 1.0;

  // Calculate Amortization Schedule & Summaries
  const calcData = useMemo(() => {
    const totalMonths = Math.max(1, Math.round(termYears * 12));
    const monthlyRate = (apr / 100) / 12;

    let emi = 0;
    if (monthlyRate > 0) {
      emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
    } else {
      emi = principal / totalMonths;
    }

    let currentBalance = principal;
    let cumInterest = 0;

    const months = [];
    const balances = [principal];
    const cumInterests = [0];
    const schedule = [];

    for (let m = 1; m <= totalMonths; m++) {
      const interestForMonth = currentBalance * monthlyRate;
      const principalForMonth = Math.min(currentBalance, emi - interestForMonth);
      currentBalance = Math.max(0, currentBalance - principalForMonth);
      cumInterest += interestForMonth;

      months.push(m);
      balances.push(currentBalance);
      cumInterests.push(cumInterest);

      schedule.push({
        month: m,
        emi: emi,
        principalPaid: principalForMonth,
        interestPaid: interestForMonth,
        remainingBalance: currentBalance
      });
    }

    const totalPayment = principal + cumInterest;
    return {
      emi,
      totalInterest: cumInterest,
      totalPayment,
      totalMonths,
      months,
      balances,
      cumInterests,
      schedule
    };
  }, [principal, termYears, apr]);

  // Export & Share CSV Schedule using expo-file-system/legacy
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      let csvContent = 'Month,Monthly Payment (INR),Principal Paid (INR),Interest Paid (INR),Remaining Balance (INR)\n';
      calcData.schedule.forEach((row) => {
        csvContent += `${row.month},${row.emi.toFixed(2)},${row.principalPaid.toFixed(2)},${row.interestPaid.toFixed(2)},${row.remainingBalance.toFixed(2)}\n`;
      });

      const fileUri = `${FileSystem.documentDirectory}Apex_Amortization_Schedule.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Apex Amortization Schedule',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('CSV Created', `File saved locally at:\n${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Export Error', err.message);
    } finally {
      setExporting(false);
    }
  };

  // Render SVG Line Chart (Balance Over Time)
  const renderLineChart = () => {
    const width = SCREEN_WIDTH - 32;
    const height = 180;
    const padding = { top: 20, bottom: 35, left: 40, right: 15 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVal = Math.max(calcData.totalPayment, principal) * 1.05;
    const totalM = calcData.totalMonths;

    const getX = (m) => padding.left + (m / totalM) * chartW;
    const getY = (v) => padding.top + chartH - (v / maxVal) * chartH;

    let pathD = `M ${getX(0)} ${getY(calcData.balances[0])}`;
    const step = Math.max(1, Math.floor(totalM / 50));
    for (let i = step; i <= totalM; i += step) {
      pathD += ` L ${getX(i)} ${getY(calcData.balances[i])}`;
    }
    pathD += ` L ${getX(totalM)} ${getY(calcData.balances[totalM])}`;
    const areaD = `${pathD} L ${getX(totalM)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`;

    let interestD = `M ${getX(0)} ${getY(0)}`;
    for (let i = step; i <= totalM; i += step) {
      interestD += ` L ${getX(i)} ${getY(calcData.cumInterests[i])}`;
    }
    interestD += ` L ${getX(totalM)} ${getY(calcData.cumInterests[totalM])}`;

    return (
      <Svg width={width} height={height}>
        {[0, maxVal * 0.5, maxVal].map((val, idx) => (
          <G key={idx}>
            <Line
              x1={padding.left}
              y1={getY(val)}
              x2={width - padding.right}
              y2={getY(val)}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4,4"
            />
            <SvgText
              x={padding.left - 4}
              y={getY(val) + 4}
              fill="#64748b"
              fontSize="9"
              textAnchor="end"
            >
              ₹{(val / 1000).toFixed(0)}k
            </SvgText>
          </G>
        ))}

        <Path d={areaD} fill="rgba(99, 102, 241, 0.25)" />
        <Path d={pathD} stroke="#6366f1" strokeWidth="2.5" fill="none" />
        <Path d={interestD} stroke="#ef4444" strokeWidth="2" fill="none" />

        {[0, Math.round(totalM * 0.33), Math.round(totalM * 0.66), totalM].map((m, idx) => (
          <SvgText
            key={idx}
            x={getX(m)}
            y={height - 8}
            fill="#64748b"
            fontSize="9"
            textAnchor="middle"
          >
            {m}m
          </SvgText>
        ))}
      </Svg>
    );
  };

  // Render SVG Donut Chart (Principal vs Interest)
  const renderDonutChart = () => {
    const size = 160;
    const strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const principalPct = calcData.totalPayment > 0 ? principal / calcData.totalPayment : 0.5;
    const principalStrokeDashoffset = circumference * (1 - principalPct);

    return (
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#6366f1"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={0}
              fill="none"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#ef4444"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={principalStrokeDashoffset}
              fill="none"
            />
          </G>
          <SvgText
            x={size / 2}
            y={size / 2 - 4}
            fill="#ffffff"
            fontSize="14"
            fontWeight="800"
            textAnchor="middle"
          >
            {(principalPct * 100).toFixed(0)}%
          </SvgText>
          <SvgText
            x={size / 2}
            y={size / 2 + 12}
            fill="#94a3b8"
            fontSize="10"
            textAnchor="middle"
          >
            Principal
          </SvgText>
        </Svg>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Simulator Controls */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Amortization Simulator</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Loan Principal Amount (₹)</Text>
          <TextInput
            style={styles.input}
            value={principalStr}
            onChangeText={setPrincipalStr}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.half]}>
            <Text style={styles.label}>Tenure (Years)</Text>
            <TextInput
              style={styles.input}
              value={termYearsStr}
              onChangeText={setTermYearsStr}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputGroup, styles.half]}>
            <Text style={styles.label}>Annual Interest (APR %)</Text>
            <TextInput
              style={styles.input}
              value={aprStr}
              onChangeText={setAprStr}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.presetRow}>
          {['6.5', '8.5', '10.5', '12.5'].map((rate) => (
            <TouchableOpacity
              key={rate}
              style={[styles.presetBtn, aprStr === rate && styles.presetBtnActive]}
              onPress={() => setAprStr(rate)}
            >
              <Text style={[styles.presetText, aprStr === rate && styles.presetTextActive]}>
                {rate}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Summary KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>MONTHLY EMI</Text>
          <Text style={styles.kpiValBlue}>₹{Math.round(calcData.emi).toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TOTAL INTEREST</Text>
          <Text style={styles.kpiValRed}>₹{Math.round(calcData.totalInterest).toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>TOTAL PAYMENT</Text>
          <Text style={styles.kpiValGold}>₹{Math.round(calcData.totalPayment).toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* Native SVG Line Chart Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Balance Over Time</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#6366f1' }]} />
            <Text style={styles.legendText}>Remaining Principal</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>Cumulative Interest</Text>
          </View>
        </View>
        {renderLineChart()}
      </View>

      {/* Native SVG Donut Chart Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Principal vs Total Interest</Text>
        {renderDonutChart()}
        <View style={styles.legendRowCenter}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#6366f1' }]} />
            <Text style={styles.legendText}>Principal (₹{principal.toLocaleString('en-IN')})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>Interest (₹{Math.round(calcData.totalInterest).toLocaleString('en-IN')})</Text>
          </View>
        </View>
      </View>

      {/* Repayment Schedule Table & Export CSV Button */}
      <View style={styles.card}>
        <View style={styles.tableHeaderRow}>
          <Text style={styles.cardTitle}>Repayment Schedule</Text>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV} disabled={exporting}>
            <Text style={styles.exportBtnText}>📥 Export CSV</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 0.8 }]}>Month</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Principal</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Interest</Text>
          <Text style={[styles.th, { flex: 1.4 }]}>Balance</Text>
        </View>
        {calcData.schedule.slice(0, 15).map((item) => (
          <View key={item.month} style={styles.tableRow}>
            <Text style={[styles.td, { flex: 0.8, color: '#94a3b8' }]}>{item.month}</Text>
            <Text style={[styles.td, { flex: 1.2, color: '#818cf8' }]}>₹{Math.round(item.principalPaid).toLocaleString('en-IN')}</Text>
            <Text style={[styles.td, { flex: 1.2, color: '#f87171' }]}>₹{Math.round(item.interestPaid).toLocaleString('en-IN')}</Text>
            <Text style={[styles.td, { flex: 1.4, color: '#ffffff' }]}>₹{Math.round(item.remainingBalance).toLocaleString('en-IN')}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  exportBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  exportBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  half: {
    flex: 1
  },
  inputGroup: {
    marginBottom: 12
  },
  label: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center'
  },
  presetBtnActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1'
  },
  presetText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  presetTextActive: {
    color: '#ffffff'
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  kpiCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  kpiLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5
  },
  kpiValBlue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#818cf8',
    marginTop: 4
  },
  kpiValRed: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f87171',
    marginTop: 4
  },
  kpiValGold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fbbf24',
    marginTop: 4
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12
  },
  legendRowCenter: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    marginTop: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    fontSize: 11,
    color: '#cbd5e1'
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4
  },
  th: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase'
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)'
  },
  td: {
    fontSize: 11,
    fontWeight: '600'
  }
});
