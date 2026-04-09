import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Search, Package, ShoppingCart } from 'lucide-react-native'
import { api, ShoppingListItem } from '../lib/api'
import { colors, spacing } from '../theme'

type StatusFilter = 'offen' | 'bestellt' | 'erledigt'

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'offen', label: 'Offen' },
  { key: 'bestellt', label: 'Bestellt' },
  { key: 'erledigt', label: 'Erledigt' },
]

const STATUS_COLORS: Record<string, string> = {
  offen: '#3b82f6',
  bestellt: '#f59e0b',
  erledigt: '#22c55e',
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['shopping-list', activeFilter, debouncedSearch],
    queryFn: () => api.searchShoppingList({
      status: activeFilter,
      search: debouncedSearch || undefined,
    }),
  })

  const items = data?.data || []
  const stats = data?.stats

  const renderItem = ({ item }: { item: ShoppingListItem }) => {
    const sc = STATUS_COLORS[item.status] || '#6b7280'
    return (
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
          {item.supplier_name && <Text style={styles.supplier} numberOfLines={1}>{item.supplier_name}</Text>}
          {item.order_number && <Text style={styles.reference}>{item.order_number}</Text>}
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
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
        <FlatList
          data={items}
          renderItem={renderItem}
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
  tabs: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, margin: spacing.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, height: 44, color: colors.text, fontSize: 15 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  articleNumber: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  articleName: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  qtyBox: { alignItems: 'center', backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 10 },
  qty: { fontSize: 18, fontWeight: '700', color: colors.primary },
  unit: { fontSize: 10, color: colors.textMuted, fontWeight: '500' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  supplier: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  reference: { fontSize: 11, color: colors.textMuted },
  date: { fontSize: 11, color: colors.textMuted },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
}) }
