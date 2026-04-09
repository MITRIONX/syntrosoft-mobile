import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone, User } from 'lucide-react-native'
import { api, CallLogEntry } from '../lib/api'
import { colors, spacing } from '../theme'

interface TelefonScreenProps {
  onSelectKunde?: (kundeId: number) => void
}

type CallFilter = 'alle' | 'verpasst'

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  if (isToday) return time
  if (isYesterday) return `Gestern ${time}`
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}. ${time}`
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return ''
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function CallIcon({ call }: { call: CallLogEntry }) {
  if (call.status === 'missed') return <PhoneMissed size={18} color="#ef4444" />
  if (call.direction === 'in') return <PhoneIncoming size={18} color="#22c55e" />
  return <PhoneOutgoing size={18} color="#3b82f6" />
}

function StatusColor(status: string): string {
  switch (status) {
    case 'missed': return '#ef4444'
    case 'answered': case 'completed': return '#22c55e'
    case 'busy': return '#f59e0b'
    default: return '#6b7280'
  }
}

function StatusLabel(status: string): string {
  switch (status) {
    case 'missed': return 'Verpasst'
    case 'answered': return 'Angenommen'
    case 'completed': return 'Beendet'
    case 'busy': return 'Besetzt'
    case 'ringing': return 'Klingelt'
    default: return status
  }
}

export function TelefonScreen({ onSelectKunde }: TelefonScreenProps) {
  const styles = createStyles()
  const [activeFilter, setActiveFilter] = useState<CallFilter>('alle')

  const { data, isLoading, error } = useQuery({
    queryKey: ['calls', activeFilter],
    queryFn: () => api.searchCalls({
      limit: 100,
      status: activeFilter === 'verpasst' ? 'missed' : undefined,
    }),
  })

  const calls = data?.data || []

  const dialNumber = (number: string) => {
    if (number) Linking.openURL(`tel:${number}`)
  }

  const renderCall = ({ item }: { item: CallLogEntry }) => {
    const displayName = item.caller_name || item.contact_name || null
    const number = item.direction === 'in' ? item.from_number : item.to_number
    const statusColor = StatusColor(item.status)

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <CallIcon call={item} />
        </View>
        <View style={styles.cardCenter}>
          <View style={styles.nameRow}>
            {displayName ? (
              <TouchableOpacity
                onPress={() => item.customer_id && onSelectKunde?.(item.customer_id)}
                disabled={!item.customer_id}
                activeOpacity={0.7}
              >
                <Text style={[styles.name, item.customer_id ? styles.nameLink : null]} numberOfLines={1}>
                  {displayName}
                </Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.time}>{formatTime(item.started_at)}</Text>
          </View>
          <View style={styles.detailRow}>
            <TouchableOpacity onPress={() => dialNumber(number)} activeOpacity={0.7} style={styles.numberButton}>
              <Phone size={11} color={colors.primary} />
              <Text style={styles.number}>{number}</Text>
            </TouchableOpacity>
            {item.duration_seconds && item.duration_seconds > 0 ? (
              <Text style={styles.duration}>{formatDuration(item.duration_seconds)}</Text>
            ) : (
              <View style={[styles.statusDot, { backgroundColor: statusColor + '25' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{StatusLabel(item.status)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.tabs}>
        {([['alle', 'Alle'], ['verpasst', 'Verpasst']] as [CallFilter, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeFilter === key && styles.tabActive]}
            onPress={() => setActiveFilter(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{String((error as Error)?.message || 'Fehler')}</Text>
        </View>
      ) : calls.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{activeFilter === 'verpasst' ? 'Keine verpassten Anrufe' : 'Keine Anrufe'}</Text>
        </View>
      ) : (
        <FlatList
          data={calls}
          renderItem={renderCall}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

function createStyles() { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cardLeft: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  cardCenter: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  nameLink: {
    color: colors.primary,
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  numberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  number: {
    fontSize: 13,
    color: colors.primary,
  },
  duration: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusDot: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
}) }
