import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, TextInput } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Search, Truck, Package, ExternalLink } from 'lucide-react-native'
import { api, TrackingEntry } from '../lib/api'
import { colors, spacing } from '../theme'

type StatusFilter = 'alle' | 'pending' | 'in_transit' | 'delivered'

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'pending', label: 'Offen' },
  { key: 'in_transit', label: 'Unterwegs' },
  { key: 'delivered', label: 'Zugestellt' },
]

const TRACKING_URLS: Record<string, string> = {
  DHL: 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=',
  DPD: 'https://tracking.dpd.de/status/de_DE/parcel/',
  UPS: 'https://www.ups.com/track?tracknum=',
  GLS: 'https://gls-group.com/DE/de/paketverfolgung?match=',
  HERMES: 'https://www.myhermes.de/empfangen/sendungsverfolgung/?search=',
}

function statusColor(status: string): string {
  switch (status) {
    case 'delivered': return '#22c55e'
    case 'in_transit': return '#3b82f6'
    case 'pending': return '#f59e0b'
    default: return '#6b7280'
  }
}

function statusLabel(entry: TrackingEntry): string {
  if (entry.status_label) return entry.status_label
  switch (entry.delivery_status) {
    case 'delivered': return 'Zugestellt'
    case 'in_transit': return 'Unterwegs'
    case 'pending': return 'Ausstehend'
    default: return entry.delivery_status || 'Unbekannt'
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${day}.${month}. ${hours}:${mins}`
}

function openTracking(carrier: string, trackingNumber: string, customUrl?: string | null) {
  if (customUrl) { Linking.openURL(customUrl); return }
  const base = TRACKING_URLS[carrier?.toUpperCase()] || null
  if (base) Linking.openURL(base + encodeURIComponent(trackingNumber))
}

export function SendungsverfolgungScreen() {
  const styles = createStyles()
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('alle')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const handleSearch = useCallback((text: string) => {
    setSearch(text)
    const timeout = setTimeout(() => setDebouncedSearch(text), 300)
    return () => clearTimeout(timeout)
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['tracking', debouncedSearch, activeFilter],
    queryFn: () => api.searchTracking({
      search: debouncedSearch || undefined,
      status: activeFilter !== 'alle' ? activeFilter : undefined,
      limit: 100,
    }),
  })

  const entries = data?.data || []

  const renderEntry = ({ item }: { item: TrackingEntry }) => {
    const sc = statusColor(item.delivery_status)
    const label = statusLabel(item)
    const orderRef = item.matched_order_number || item.reference || item.lieferanten_bestellnr || null
    const supplier = item.lieferant || item.supplier_name || null

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openTracking(item.dienstleister, item.trackingnummer, item.tracking_url)}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={styles.carrierRow}>
            <Truck size={14} color={colors.textMuted} />
            <Text style={styles.carrier}>{item.dienstleister}</Text>
            {supplier && <Text style={styles.supplier} numberOfLines={1}>({supplier})</Text>}
          </View>
          <View style={[styles.badge, { backgroundColor: sc + '25' }]}>
            <Text style={[styles.badgeText, { color: sc }]}>{label}</Text>
          </View>
        </View>

        <View style={styles.trackingRow}>
          <Text style={styles.trackingNumber} numberOfLines={1}>{item.trackingnummer}</Text>
          <ExternalLink size={12} color={colors.primary} />
        </View>

        <View style={styles.cardBottom}>
          {orderRef && <Text style={styles.reference} numberOfLines={1}>{orderRef}</Text>}
          <Text style={styles.date}>{formatDate(item.delivered_at || item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeFilter === tab.key && styles.tabActive]}
            onPress={() => setActiveFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tracking, Auftrag, Lieferant..."
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
          <Text style={styles.errorText}>{String((error as Error)?.message || 'Fehler')}</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Keine Sendungen gefunden</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={renderEntry}
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
    fontSize: 13,
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
  searchInput: {
    flex: 1,
    height: 44,
    color: colors.text,
    fontSize: 15,
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
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  carrierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  carrier: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  supplier: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  trackingNumber: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    flex: 1,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reference: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  date: {
    fontSize: 11,
    color: colors.textMuted,
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
