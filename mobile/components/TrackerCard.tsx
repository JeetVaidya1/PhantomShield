import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface TrackerCardProps {
  totalBlocked: number;
  loading: boolean;
  onPress: () => void;
}

export function TrackerCard({ totalBlocked, loading, onPress }: TrackerCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityLabel={`${totalBlocked} trackers blocked this month. Tap to view details.`}
      accessibilityRole="button"
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon} accessibilityLabel="Shield icon">
          🛡️
        </Text>
      </View>
      <View style={styles.textContainer}>
        {loading ? (
          <ActivityIndicator size="small" color="#6366F1" />
        ) : (
          <Text style={styles.count} accessibilityLabel={`${totalBlocked} trackers blocked`}>
            {totalBlocked.toLocaleString()}
          </Text>
        )}
        <Text style={styles.label}>Trackers Blocked This Month</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  count: {
    fontSize: 32,
    fontWeight: '700',
    color: '#E0E7FF',
  },
  label: {
    fontSize: 14,
    color: '#A5B4FC',
    marginTop: 2,
  },
});
