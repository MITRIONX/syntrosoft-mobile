import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, SectionList } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Search, Truck, AlertTriangle, CheckCircle } from 'lucide-react-native'
import { api, ShoppingListItem, SupplierGroup } from '../lib/api'
import { colors, spacing } from '../theme'

type StatusFilter = 'offen' | 'bestellt' | 'erledigt'

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'offen', label: 'Offen' },
  { key: 'bestellt', label: 'Bestellt' },
  { key: 'erledigt', label: 'Erledigt' },
]

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function SupplierHeader({ group }: { group: SupplierGroup }) {
  const styles = createStyles()
  const freeAt = group.versandkostenfrei_ab
  const current = group.total_ek_netto
  const isFree = freeAt != null && current >= freeAt
  const missing = freeAt != null ? Math.max(0, freeAt - current) : null
  const pct = freeAt != null && freeAt > 0 ? Math.min(100, (current / freeAt) * 100) : null

  return (
    <View style={styles.supplierHeader}>
      <View style={styles.supplierNameRow}>
        <Text style={styles.supplierName}>{group.supplier_name || 'Kein Lieferant'}</Text>
        <Text style={styles.supplierInfo}>{group.item_count} Pos. — {formatCurrency(current)}</Text>
      </View>

      {freeAt != null && (
        <View style={styles.shippingInfo}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${pct ?? 0}%` as any, backgroundColor: isFree ? '#22c55e' : '#f59e0b' }]} />
          </View>
          <View style={styles.shippingRow}>
            {isFree ? (
              <>
                <CheckCircle size={13} color="#22c55e" />
                <Text style={[styles.shippingText, { color: '#22c55e' }]}>Frachtfrei</Text>
              </>
            ) : (
              <>
                <Truck size={13} color="#f59e0b" />
                <Text style={styles.shippingText}>
                  Noch <Text style={{ fontWeight: '700', color: '#f59e0b' }}>{formatCurrency(missing!)}</Text> bis frachtfrei ({formatCurrency(freeAt)})
                </Text>
              </>
            )}
            {group.versandkosten != null && group.versandkosten > 0 && !isFree && (
              <Text style={styles.shippingCost}>Versand: {formatCurrency(group.versandkosten)}</Text>
            )}
          </View>
        </View>
      )}

      {group.below_minimum && group.mindestbestellwert != null && (
        <View style={styles.warningRow}>
          <AlertTriangle size={13} color="#ef4444" />
          <Text style={styles.warningText}>
            Unter Mindestbestellwert ({formatCurrency(group.mindestbestellwert)})
          </Text>
        </View>
      )}
    </View>
  )
}

export function EinkaufslisteScreen() {
  const styles = createStyles()
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('offen')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const handleSearch = useCallback((text: string) => {
    setSearch(text)
    const timeout = setTimeout(() => setDebouncedSearch(text), 300)
    return () => clearTimeout(timeout)
  }, [])

  const { data: listData, isLoading: listLoading, error: listError } = useQuery({
    queryKey: ['shopping-list', activeFilter, debouncedSearch],
    queryFn: () => api.searchShoppingList({ status: activeFilter, search: debouncedSearch || undefined }),
  })

  const { data: previewData } = useQuery({
    queryKey: ['shopping-list-preview'],
    queryFn: () => api.getShoppingListPreview(),
    enabled: activeFilter === 'offen',
  })

  const items = listData?.data || []
  const stats = listData?.stats
  const supplierGroups = previewData?.data || []

  // Für "offen" Tab: nach Lieferant gruppiert anzeigen
  const sections = activeFilter === 'offen' && supplierGroups.length > 0
    ? supplierGroups.map(g => ({
        group: g,
        data: items.filter(i =>
          g.supplier_id ? i.supplier_id === g.supplier_id : !i.supplier_id
        ),
      })).filter(s => s.data.length > 0 || !debouncedSearch)
    : [{ group: null as SupplierGroup | null, data: items }]

  const renderItem = ({ item }: { item: ShoppingListItem }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          {item.artikel_nummer && <Text style={styles.articleNumber}>{item.artikel_nummer}</Text>}
          <Text style={styles.articleName} numberOfLines={2}>{item.artikel_name || 'Unbekannt'}</Text>
        </View>
        <View style={styles.qtyBox}>
          <Text style={styles.qty}>{item.menge}</Text>
          <Text style={styles.unit}>{item.einheit}</Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        {item.order_number && <Text style={styles.reference}>{item.order_number}</Text>}
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
      </View>
    </View>
  )

  const isLoading = listLoading
  const error = listError

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
            <Text style={[styles.tabText, activeFilter === tab.key && styles.tabTextActive]}>
              {tab.label}{stats ? ` (${stats[tab.key]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Artikel, Lieferant, Auftrag..."
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
      ) : items.length === 0 ? (
        <View style={styles.centered}><Text style={styles.emptyText}>Keine Einträge</Text></View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={({ section }) =>
            section.group ? <SupplierHeader group={section.group} /> : null
          }
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  )
}

function createStyles() { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, margin: spacing.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, height: 44, color: colors.text, fontSize: 15 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  supplierHeader: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, marginTop: spacing.md, borderWidth: 1, borderColor: colors.primary + '40' },
  supplierNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  supplierName: { fontSize: 15, fontWeight: '700', color: colors.text },
  supplierInfo: { fontSize: 12, color: colors.textMuted },
  shippingInfo: { marginTop: 4 },
  progressBarBg: { height: 6, backgroundColor: colors.surfaceHover, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3 },
  shippingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  shippingText: { fontSize: 12, color: colors.textSecondary },
  shippingCost: { fontSize: 11, color: colors.textMuted, marginLeft: 'auto' },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  warningText: { fontSize: 12, color: '#ef4444' },
  card: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  articleNumber: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  articleName: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 1 },
  qtyBox: { alignItems: 'center', backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  qty: { fontSize: 16, fontWeight: '700', color: colors.primary },
  unit: { fontSize: 9, color: colors.textMuted, fontWeight: '500' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reference: { fontSize: 11, color: colors.textMuted },
  date: { fontSize: 11, color: colors.textMuted },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
}) }
