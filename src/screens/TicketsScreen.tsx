import { useState, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Search, MessageSquare, MessageCircle, Clock } from 'lucide-react-native'
import { api, Ticket } from '../lib/api'
import { colors, spacing } from '../theme'

interface TicketsScreenProps {
  onSelectTicket: (ticket: Ticket) => void
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return `vor ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)}h`
  if (diff < 172800) return 'gestern'
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function StatusBadge({ name, color }: { name: string; color: string }) {
  const bg = color.startsWith('#') ? color : '#6b7280'
  return (
    <View style={[styles.badge, { backgroundColor: bg + '25', borderColor: bg + '50' }]}>
      <Text style={[styles.badgeText, { color: bg }]}>{name}</Text>
    </View>
  )
}

export function TicketsScreen({ onSelectTicket }: TicketsScreenProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'open' | 'final'>('open')

  const handleSearch = useCallback((text: string) => {
    setSearch(text)
    const timeout = setTimeout(() => setDebouncedSearch(text), 300)
    return () => clearTimeout(timeout)
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets', debouncedSearch, activeTab],
    queryFn: () => api.searchTickets(debouncedSearch, activeTab, 50),
    enabled: true,
  })

  const tickets = data?.tickets || data?.data || []

  const renderTicket = ({ item }: { item: Ticket }) => {
    const contactName = item.customer_display_name || item.supplier_display_name || item.customer_email || 'Unbekannt'

    return (
      <TouchableOpacity style={styles.card} onPress={() => onSelectTicket(item)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <MessageSquare size={18} color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.ticketNumber}>#{item.ticket_number}</Text>
            <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
          </View>
          <StatusBadge name={item.status_name} color={item.status_color} />
        </View>

        <View style={styles.cardRow}>
          <View style={styles.cardDetail}>
            <MessageCircle size={12} color={colors.textMuted} />
            <Text style={styles.cardDetailText} numberOfLines={1}>{contactName}</Text>
          </View>
          <View style={styles.cardDetailRight}>
            <View style={styles.cardDetail}>
              <MessageSquare size={12} color={colors.textMuted} />
              <Text style={styles.cardDetailText}>{item.message_count}</Text>
            </View>
            <View style={styles.cardDetail}>
              <Clock size={12} color={colors.textMuted} />
              <Text style={styles.cardDetailText}>{timeAgo(item.updated_at)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'open' && styles.tabActive]}
          onPress={() => setActiveTab('open')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'open' && styles.tabTextActive]}>Offen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'final' && styles.tabActive]}
          onPress={() => setActiveTab('final')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'final' && styles.tabTextActive]}>Erledigt</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tickets suchen..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{String((error as Error)?.message || 'Unbekannter Fehler')}</Text>
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Keine Tickets gefunden</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderTicket}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: colors.text,
    fontSize: 16,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  ticketNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  subject: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 44,
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardDetailRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardDetailText: {
    fontSize: 12,
    color: colors.textSecondary,
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
})
