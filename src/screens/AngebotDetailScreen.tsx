import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Package, Euro } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { api, Quote, QuoteItem } from '../lib/api'
import { colors, spacing } from '../theme'

interface Props {
  quote: Quote
  onBack: () => void
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '0,00 \u20AC'
  return Number(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC'
}

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

export function AngebotDetailScreen({ quote, onBack }: Props) {
  const styles = createStyles()
  const insets = useSafeAreaInsets()

  const { data, isLoading } = useQuery({
    queryKey: ['quote-items', quote.id],
    queryFn: () => api.getQuoteItems(quote.id),
  })

  const items = Array.isArray(data?.data) ? data.data : []
  const statusColor = STATUS_COLORS[quote.status?.toLowerCase()] || '#6b7280'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{quote.quote_number}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status + Date */}
        <View style={styles.statusRow}>
          <View style={[styles.badge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel(quote.status)}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(quote.quote_date)}</Text>
        </View>

        {/* Valid until */}
        {quote.valid_until && (
          <Text style={styles.validUntil}>Gueltig bis: {formatDate(quote.valid_until)}</Text>
        )}

        {/* Customer */}
        <Text style={styles.customerName}>{quote.customer_display_name || 'Unbekannt'}</Text>

        {/* Amounts */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Euro size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Betraege</Text>
          </View>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Netto</Text>
              <Text style={styles.gridValue}>{formatCurrency(quote.total_net)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Brutto</Text>
              <Text style={[styles.gridValue, styles.gridValuePrimary]}>{formatCurrency(quote.total_gross)}</Text>
            </View>
          </View>
        </View>

        {/* Positionen */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Package size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Positionen ({items.length})</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
          ) : items.length === 0 ? (
            <Text style={styles.emptyText}>Keine Positionen</Text>
          ) : (
            items.map((item: QuoteItem, index: number) => (
              <View key={item.id} style={[styles.positionRow, index > 0 && styles.positionRowBorder]}>
                <View style={styles.positionLeft}>
                  <Text style={styles.positionNumber}>{item.position_number}.</Text>
                </View>
                <View style={styles.positionInfo}>
                  {item.article_number && (
                    <Text style={styles.articleNumber}>{item.article_number}</Text>
                  )}
                  <Text style={styles.articleName} numberOfLines={2}>
                    {item.article_name || 'Unbekannter Artikel'}
                  </Text>
                  <Text style={styles.positionCalc}>
                    {item.quantity} {item.unit} x {formatCurrency(item.unit_price_net)}
                  </Text>
                </View>
                <Text style={styles.positionTotal}>{formatCurrency(item.total_gross)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles() { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  dateText: { fontSize: 13, color: colors.textSecondary },
  validUntil: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  customerName: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { width: '47%', backgroundColor: colors.background, borderRadius: 8, padding: spacing.sm },
  gridLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  gridValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  gridValuePrimary: { color: colors.primary },
  emptyText: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  positionRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 8 },
  positionRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  positionLeft: { width: 24, paddingTop: 2 },
  positionNumber: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  positionInfo: { flex: 1 },
  articleNumber: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  articleName: { fontSize: 14, color: colors.text, lineHeight: 19 },
  positionCalc: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  positionTotal: { fontSize: 14, fontWeight: '600', color: colors.text, paddingTop: 2 },
}) }
