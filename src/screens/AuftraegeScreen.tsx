import { useState, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Search, ShoppingCart, Calendar, Euro, Package } from 'lucide-react-native'
import { api, Auftrag } from '../lib/api'
import { colors, spacing } from '../theme'

interface AuftraegeScreenProps {
  onSelectAuftrag: (auftrag: Auftrag) => void
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

const STATUS_COLORS: Record<string, string> = {
  offen: '#3b82f6',
  in_bearbeitung: '#f59e0b',
  versendet: '#a855f7',
  abgeschlossen: '#22c55e',
  storniert: '#ef4444',
}

function StatusBadge({ status }: { status: string }) {
  const styles = createStyles()
  const color = STATUS_COLORS[status] || '#6b7280'
  const label = status.replace(/_/g, ' ')
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  )
}

export function AuftraegeScreen({ onSelectAuftrag }: AuftraegeScreenProps) {
  const styles = createStyles()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const handleSearch = useCallback((text: string) => {
    setSearch(text)
    const timeout = setTimeout(() => setDebouncedSearch(text), 300)
    return () => clearTimeout(timeout)
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['auftraege', debouncedSearch],
    queryFn: () => api.searchAuftraege(debouncedSearch, 50),
    enabled: true,
  })

  const auftraege = data?.data || []

  const renderAuftrag = ({ item }: { item: Auftrag }) => {
    const customerName =
      item.customer_display_name ||
      item.billing_company ||
      [item.billing_first_name, item.billing_last_name].filter(Boolean).join(' ') ||
      'Unbekannt'

    return (
      <TouchableOpacity style={styles.card} onPress={() => onSelectAuftrag(item)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <ShoppingCart size={18} color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
            <Text style={styles.customerName} numberOfLines={1}>{customerName}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        <View style={styles.cardRow}>
          <View style={styles.cardDetail}>
            <Calendar size={12} color={colors.textMuted} />
            <Text style={styles.cardDetailText}>{formatDate(item.order_date)}</Text>
          </View>
          <View style={styles.cardDetail}>
            <Package size={12} color={colors.textMuted} />
            <Text style={styles.cardDetailText}>{item.items_count} Pos.</Text>
          </View>
          <View style={styles.cardDetail}>
            <Euro size={12} color={colors.textMuted} />
            <Text style={[styles.cardDetailText, styles.amount]}>{formatCurrency(item.total_gross)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Aufträge suchen..."
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
          <Text style={styles.errorText}>{(error as Error).message}</Text>
        </View>
      ) : auftraege.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {debouncedSearch ? 'Keine Aufträge gefunden' : 'Suchbegriff eingeben'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={auftraege}
          renderItem={renderAuftrag}
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
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  customerName: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 16,
    paddingLeft: 44,
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardDetailText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  amount: {
    fontWeight: '600',
    color: colors.text,
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
