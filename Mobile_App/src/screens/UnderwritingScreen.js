import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { API_BASE } from '../config';

export default function UnderwritingScreen({ token, onSwitchToAmortization }) {
  const [appIncome, setAppIncome] = useState('6500');
  const [coIncome, setCoIncome] = useState('0');
  const [loanAmount, setLoanAmount] = useState('150000');
  const [loanTermYears, setLoanTermYears] = useState('30');
  const [creditHistory, setCreditHistory] = useState('1.0');
  const [education, setEducation] = useState('Graduate');
  const [employmentType, setEmploymentType] = useState('Salaried');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [dependents, setDependents] = useState('0');
  const [propertyArea, setPropertyArea] = useState('Urban');

  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState(null);

  const handlePredict = async () => {
    setEvaluating(true);
    try {
      const termMonths = parseInt(loanTermYears, 10) * 12;
      const payload = {
        ApplicantIncome: parseFloat(appIncome) || 0,
        CoapplicantIncome: parseFloat(coIncome) || 0,
        LoanAmount: parseFloat(loanAmount) || 0,
        Loan_Amount_Term: termMonths,
        CreditHistory: parseFloat(creditHistory),
        Education: education,
        EmploymentType: employmentType,
        MaritalStatus: maritalStatus,
        Dependents: dependents,
        PropertyArea: propertyArea
      };

      const res = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Underwriting prediction failed.');
      }

      const data = await res.json();
      setResult({
        ...data,
        literalLoanAmount: parseFloat(loanAmount) || 0
      });
    } catch (err) {
      Alert.alert('Evaluation Error', err.message);
    } finally {
      setEvaluating(false);
    }
  };

  const getAccentColor = (status, isApproved) => {
    if (status === 'Counter-Offer Proposed') return '#c9922a';
    if (status === 'Conditional Approval') return '#3b82f6';
    if (isApproved) return '#10b981';
    return '#ef4444';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Applicant Underwriting Intake</Text>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.half]}>
            <Text style={styles.label}>Applicant Income (₹)</Text>
            <TextInput
              style={styles.input}
              value={appIncome}
              onChangeText={setAppIncome}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputGroup, styles.half]}>
            <Text style={styles.label}>Co-Applicant Income (₹)</Text>
            <TextInput
              style={styles.input}
              value={coIncome}
              onChangeText={setCoIncome}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.half]}>
            <Text style={styles.label}>Requested Loan (₹)</Text>
            <TextInput
              style={styles.input}
              value={loanAmount}
              onChangeText={setLoanAmount}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputGroup, styles.half]}>
            <Text style={styles.label}>Tenure (Years)</Text>
            <TextInput
              style={styles.input}
              value={loanTermYears}
              onChangeText={setLoanTermYears}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Credit History Selector */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Credit History Status</Text>
          <View style={styles.buttonSelector}>
            <TouchableOpacity
              style={[styles.selectorBtn, creditHistory === '1.0' && styles.selectorBtnActive]}
              onPress={() => setCreditHistory('1.0')}
            >
              <Text style={[styles.selectorText, creditHistory === '1.0' && styles.selectorTextActive]}>
                Excellent (1.0)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.selectorBtn, creditHistory === '0.0' && styles.selectorBtnActive]}
              onPress={() => setCreditHistory('0.0')}
            >
              <Text style={[styles.selectorText, creditHistory === '0.0' && styles.selectorTextActive]}>
                Poor / None (0.0)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Education Selector */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Education Level</Text>
          <View style={styles.buttonSelector}>
            <TouchableOpacity
              style={[styles.selectorBtn, education === 'Graduate' && styles.selectorBtnActive]}
              onPress={() => setEducation('Graduate')}
            >
              <Text style={[styles.selectorText, education === 'Graduate' && styles.selectorTextActive]}>
                Graduate
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.selectorBtn, education === 'Not Graduate' && styles.selectorBtnActive]}
              onPress={() => setEducation('Not Graduate')}
            >
              <Text style={[styles.selectorText, education === 'Not Graduate' && styles.selectorTextActive]}>
                Non-Graduate
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Property Area Selector */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Property Location</Text>
          <View style={styles.buttonSelector}>
            {['Urban', 'Semiurban', 'Rural'].map((area) => (
              <TouchableOpacity
                key={area}
                style={[styles.selectorBtn, propertyArea === area && styles.selectorBtnActive]}
                onPress={() => setPropertyArea(area)}
              >
                <Text style={[styles.selectorText, propertyArea === area && styles.selectorTextActive]}>
                  {area}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Evaluate Button */}
        <TouchableOpacity style={styles.evalBtn} onPress={handlePredict} disabled={evaluating}>
          {evaluating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.evalBtnText}>Evaluate Decision Pipeline</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Decision Output Card */}
      {result && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Decision Output</Text>
          {(() => {
            const isApproved = result.prediction === 1;
            const accent = getAccentColor(result.status, isApproved);
            const score = Math.min(result.confidence_percentage, 100);
            const counterAmt = result.counter_offer_amount;

            return (
              <View style={[styles.decisionCard, { borderLeftColor: accent }]}>
                {/* Track Badge */}
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{result.track || 'Income-Based Capacity Track'}</Text>
                </View>

                {/* Status Heading */}
                <Text style={[styles.statusHeading, { color: accent }]}>{result.status}</Text>
                <Text style={styles.tierSubtext}>{(result.tier || '').toUpperCase()}</Text>

                {/* Capacity Score Progress Bar */}
                <View style={styles.scoreHeader}>
                  <Text style={styles.scoreLabel}>FINANCIAL CAPACITY SCORE</Text>
                  <Text style={styles.scoreVal}>{score.toFixed(1)}%</Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${score}%`, backgroundColor: accent }]} />
                  {/* 75% Risk threshold marker */}
                  <View style={styles.thresholdMarker} />
                </View>

                {/* Notes */}
                <Text style={styles.notesText}>{result.actionable_notes}</Text>

                {/* Requested vs Pre-Approved Side-by-Side Comparison */}
                {counterAmt && (
                  <View style={styles.comparisonContainer}>
                    <View style={styles.compBoxRequested}>
                      <Text style={styles.compLabel}>REQUESTED</Text>
                      <Text style={styles.compValReq}>₹{result.literalLoanAmount.toLocaleString('en-IN')}</Text>
                      <Text style={styles.compSubReq}>✗ Exceeds risk limit</Text>
                    </View>
                    <Text style={styles.arrowIcon}>→</Text>
                    <View style={[styles.compBoxApproved, { borderColor: accent }]}>
                      <Text style={[styles.compLabel, { color: accent }]}>PRE-APPROVED LIMIT</Text>
                      <Text style={[styles.compValApp, { color: accent }]}>
                        ₹{counterAmt.toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.compSubApp}>✓ Within capacity</Text>
                    </View>
                  </View>
                )}

                {/* Conditions List */}
                {result.conditions && result.conditions.length > 0 && (
                  <View style={styles.conditionsBox}>
                    <Text style={styles.conditionsTitle}>📋 UNDERWRITING CONDITIONS</Text>
                    {result.conditions.map((cond, idx) => (
                      <Text key={idx} style={styles.conditionItem}>
                        • {cond}
                      </Text>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.simBtn}
                  onPress={() => onSwitchToAmortization(counterAmt || result.literalLoanAmount, parseInt(loanTermYears, 10))}
                >
                  <Text style={styles.simBtnText}>Open in Amortization Simulator 🧮</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
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
  content: {
    padding: 16,
    paddingBottom: 40
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  half: {
    flex: 1
  },
  inputGroup: {
    marginBottom: 14
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
  buttonSelector: {
    flexDirection: 'row',
    gap: 8
  },
  selectorBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center'
  },
  selectorBtnActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1'
  },
  selectorText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  selectorTextActive: {
    color: '#ffffff'
  },
  evalBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8
  },
  evalBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  decisionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 5
  },
  badgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase'
  },
  statusHeading: {
    fontSize: 22,
    fontWeight: '800'
  },
  tierSubtext: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 12
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b'
  },
  scoreVal: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a'
  },
  progressBg: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 10
  },
  progressFill: {
    height: '100%',
    borderRadius: 4
  },
  thresholdMarker: {
    position: 'absolute',
    left: '75%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ef4444'
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#475569',
    marginBottom: 12
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12
  },
  compBoxRequested: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10
  },
  compBoxApproved: {
    flex: 1,
    backgroundColor: '#fef9ee',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 10
  },
  compLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8'
  },
  compValReq: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748b'
  },
  compValApp: {
    fontSize: 16,
    fontWeight: '800'
  },
  compSubReq: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: 2
  },
  compSubApp: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 2
  },
  arrowIcon: {
    fontSize: 18,
    color: '#94a3b8'
  },
  conditionsBox: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    marginTop: 8
  },
  conditionsTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4
  },
  conditionItem: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16
  },
  simBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14
  },
  simBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5'
  }
});
