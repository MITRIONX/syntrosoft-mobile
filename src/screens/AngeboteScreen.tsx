import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Search, FileText } from 'lucide-react-native'
import { api, Quote } from '../lib/api'
import { AngebotDetailScreen } from './AngebotDetailScreen'
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
  if (value == null) return '0,00 \u20AC'
  return Number(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC'
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  accepted: '#22c55e',
  cancelled: '#ef4444',
  sent: '#3b82f6',
  expired: '#f59e0b',
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Entwurf',
    accepted: 'Angenommen',
    cancelled: 'Storniert',
    sent: 'Versendet',
    expired: 'Abgelaufen',
  }
  return labels[status.toLowerCase()] || status
}

export function AngeboteScreen() {
  const styles = createStyles()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)

  const handleSearch = useCallback((text: string) => {
    setSearch(text)
    const timeout = setTimeout(() => setDebouncedSearch(text), 300)
    return () => clearTimeout(timeout)
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotes', debouncedSearch],
    queryFn: () => api.searchQuotes({
      search: debouncedSearch || undefined,
      limit: 200,
    }),
  })

  const quotes = Array.isArray(data?.data) ? data.data : []

  if (selectedQuote) {
    return <AngebotDetailScreen quote={selectedQuote} onBack={() => setSelectedQuote(null)} />
  }

  const renderQuote = ({ item }: { item: Quote }) => {
    const color = STATUS_COLORS[item.status?.toLowerCase()] || '#6b7280'

    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelectedQuote(item)} activeOpacity={0.7}>
        <View style={styles.cardTop}>
          <View style={styles.iconBox}>
            <FileText size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.orderRow}>
              <Text style={styles.orderNumber}>{item.quote_number}</Text>
              <Text style={styles.date}>{formatDate(item.quote_date)}</Text>
            </View>
            <Text style={styles.customer} numberOfLines={1}>
              {item.customer_display_name || 'Unbekannt'}
            </Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.detail}>{item.items_count} Pos.</Text>
          <Text style={[styles.detail, styles.amount]}>{formatCurrency(item.total_gross)}</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={[styles.badge, { backgroundColor: color + '25' }]}>
              <Text style={[styles.badgeText, { color }]}>{statusLabel(item.status)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Angebotsnr, Kunde..."
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
      ) : quotes.length === 0 ? (
        <View style={styles.centered}><Text style={styles.emptyText}>Keine Angebote gefunden</Text></View>
      ) : (
        <FlatList
          data={quotes}
          renderItem={renderQuote}
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
  cardTop: { flexDirection: 'row', marginBottom: 6, alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 15, fontWeight: '600', color: colors.text },
  date: { fontSize: 11, color: colors.textMuted },
  customer: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  detail: { fontSize: 12, color: colors.textMuted },
  amount: { fontWeight: '600', color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
}) }
