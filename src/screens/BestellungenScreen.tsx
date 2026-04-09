import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Search, Package } from 'lucide-react-native'
import { api, PurchaseOrder } from '../lib/api'
import { BestellungDetailScreen } from './BestellungDetailScreen'
import { colors, spacing } from '../theme'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const [y, m, d] = dateStr.trim().split('-')
    return `${d}.${m}.${y}`
  }
  const dt = new Date(dateStr)
  if (isNaN(dt.getTime())) return ''
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '0,00 €'
  return Number(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function BestellungenScreen() {
  const styles = createStyles()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)

  if (selectedOrder) {
    try {
      return <BestellungDetailScreen order={selectedOrder} onBack={() => setSelectedOrder(null)} />
    } catch (e: any) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 20 }}>
          <Text style={{ color: colors.danger, fontSize: 16, textAlign: 'center' }}>Fehler: {e?.message || 'Unbekannt'}</Text>
          <TouchableOpacity onPress={() => setSelectedOrder(null)} style={{ marginTop: 20, padding: 12, backgroundColor: colors.primary, borderRadius: 8 }}>
            <Text style={{ color: '#fff' }}>Zurück</Text>
          </TouchableOpacity>
        </View>
      )
    }
  }

  const handleSearch = useCallback((text: string) => {
    setSearch(text)
    const timeout = setTimeout(() => setDebouncedSearch(text), 300)
    return () => clearTimeout(timeout)
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', debouncedSearch],
    queryFn: () => api.searchPurchaseOrders({
      search: debouncedSearch || undefined,
      limit: 100,
    }),
  })

  const orders = Array.isArray(data?.data) ? data.data : []

  const renderOrder = ({ item }: { item: PurchaseOrder }) => {
    const delivered = (item.qty_delivered || 0)
    const total = (item.qty_total || 0)
    const isComplete = total > 0 && delivered >= total
    const statusColor = isComplete ? '#22c55e' : delivered > 0 ? '#f59e0b' : '#3b82f6'
    const statusText = item.status_text || (isComplete ? 'Geliefert' : delivered > 0 ? 'Teillieferung' : 'Bestellt')

    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelectedOrder(item)} activeOpacity={0.7}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.orderRow}>
              <Text style={styles.orderNumber}>{item.order_number}</Text>
              <Text style={styles.date}>{formatDate(item.order_date)}</Text>
            </View>
            <Text style={styles.supplier} numberOfLines={1}>{item.supplier_name || 'Unbekannt'}</Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.detail}>{item.items_count} Pos.</Text>
          {total > 0 && <Text style={styles.detail}>{delivered}/{total} Stk.</Text>}
          <Text style={[styles.detail, styles.amount]}>{formatCurrency(item.total_net)}</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={[styles.badge, { backgroundColor: statusColor + '25' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusText}</Text>
            </View>
          </View>
        </View>
        {item.reference_order_number && (
          <Text style={styles.reference}>Auftrag: {item.reference_order_number}</Text>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Bestellnr, Lieferant..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.centered}><Text style={styles.errorText}>{String((error as Error)?.message || 'Fehler')}</Text></View>
      ) : orders.length === 0 ? (
        <View style={styles.centered}><Text style={styles.emptyText}>Keine Bestellungen gefunden</Text></View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

function createStyles() { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, margin: spacing.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, height: 44, color: colors.text, fontSize: 15 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', marginBottom: 6 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 15, fontWeight: '600', color: colors.text },
  date: { fontSize: 11, color: colors.textMuted },
  supplier: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  detail: { fontSize: 12, color: colors.textMuted },
  amount: { fontWeight: '600', color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  reference: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
}) }
