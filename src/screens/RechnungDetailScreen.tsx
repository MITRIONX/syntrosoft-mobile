import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Package, Euro } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { api, Invoice, InvoiceItem } from '../lib/api'
import { colors, spacing } from '../theme'

interface Props {
  invoice: Invoice
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
  sent: '#3b82f6',
  cancelled: '#ef4444',
  finalized: '#22c55e',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: '#22c55e',
  partial: '#f59e0b',
  open: '#3b82f6',
  overdue: '#ef4444',
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Entwurf',
    sent: 'Versendet',
    cancelled: 'Storniert',
    finalized: 'Abgeschlossen',
  }
  return labels[status.toLowerCase()] || status
}

function paymentStatusLabel(status: string | null): string {
  if (!status) return 'Offen'
  const labels: Record<string, string> = {
    paid: 'Bezahlt',
    partial: 'Teilzahlung',
    open: 'Offen',
    overdue: 'Ueberfaellig',
  }
  return labels[status.toLowerCase()] || status
}

export function RechnungDetailScreen({ invoice, onBack }: Props) {
  const styles = createStyles()
  const insets = useSafeAreaInsets()

  const { data, isLoading } = useQuery({
    queryKey: ['invoice-items', invoice.id],
    queryFn: () => api.getInvoiceItems(invoice.id),
  })

  const items = Array.isArray(data?.data) ? data.data : []
  const invoiceStatusColor = STATUS_COLORS[invoice.status?.toLowerCase()] || '#6b7280'
  const payColor = PAYMENT_STATUS_COLORS[invoice.payment_status?.toLowerCase() || 'open'] || '#3b82f6'
  const outstanding = Number(invoice.outstanding_amount) || 0

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{invoice.invoice_number}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status badges */}
        <View style={styles.statusRow}>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: invoiceStatusColor + '20', borderColor: invoiceStatusColor + '40' }]}>
              <Text style={[styles.badgeText, { color: invoiceStatusColor }]}>{statusLabel(invoice.status)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: payColor + '20', borderColor: payColor + '40' }]}>
              <Text style={[styles.badgeText, { color: payColor }]}>{paymentStatusLabel(invoice.payment_status)}</Text>
            </View>
          </View>
          <Text style={styles.dateText}>{formatDate(invoice.invoice_date)}</Text>
        </View>

        {/* Customer + Due date */}
        <Text style={styles.customerName}>{invoice.customer_name || 'Unbekannt'}</Text>
        {invoice.due_date && (
          <Text style={styles.dueDate}>Faellig: {formatDate(invoice.due_date)}</Text>
        )}

        {/* Amounts */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Euro size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Betraege</Text>
          </View>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Netto</Text>
              <Text style={styles.gridValue}>{formatCurrency(invoice.total_net)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Brutto</Text>
              <Text style={[styles.gridValue, styles.gridValuePrimary]}>{formatCurrency(invoice.total_gross)}</Text>
            </View>
            {outstanding > 0 && (
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Ausstehend</Text>
                <Text style={[styles.gridValue, { color: '#ef4444' }]}>{formatCurrency(outstanding)}</Text>
              </View>
            )}
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
            items.map((item: InvoiceItem, index: number) => (
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
                    {item.quantity} {item.unit} x {formatCurrency(item.unit_price_net)} ({item.tax_rate}% MwSt.)
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
  badges: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  dateText: { fontSize: 13, color: colors.textSecondary },
  customerName: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
  dueDate: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
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
