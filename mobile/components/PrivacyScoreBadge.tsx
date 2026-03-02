import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import {
  PrivacyScore,
  getRiskLevel,
  getRiskColor,
  getRiskLabel,
} from '../hooks/usePrivacyScore';

interface PrivacyScoreBadgeProps {
  score: PrivacyScore | null;
  loading: boolean;
}

export function PrivacyScoreBadge({ score, loading }: PrivacyScoreBadgeProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#A5B4FC" />
        <Text style={styles.loadingText}>Checking privacy score...</Text>
      </View>
    );
  }

  if (!score) {
    return null; // Don't show anything if no data
  }

  const level = getRiskLevel(score.privacy_score);
  const color = getRiskColor(level);
  const label = getRiskLabel(level);

  return (
    <View
      style={[styles.container, { borderLeftColor: color }]}
      accessibilityLabel={`Privacy score: ${score.privacy_score} out of 100, ${label}`}
    >
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.scoreText, { color }]}>
          {score.privacy_score}/100
        </Text>
        <Text style={[styles.labelText, { color }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1E1B4B',
    borderRadius: 8,
    borderLeftWidth: 3,
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
  },
  labelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingText: {
    color: '#A5B4FC',
    fontSize: 13,
    marginLeft: 8,
  },
});
