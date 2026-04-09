import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, ShoppingCart, User, MapPin, Package, Euro, Truck } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { api, Auftrag, AuftragDetail, AuftragItem } from '../lib/api'
import { colors, spacing } from '../theme'

interface AuftragDetailScreenProps {
  auftrag: Auftrag
  onBack: () => void
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
  const color = STATUS_COLORS[status] || '#6b7280'
  const label = status.replace(/_/g, ' ')
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  )
}

export function AuftragDetailScreen({ auftrag, onBack }: AuftragDetailScreenProps) {
  const insets = useSafeAreaInsets()

  const { data, isLoading, error } = useQuery({
    queryKey: ['auftrag', auftrag.id],
    queryFn: () => api.getAuftrag(auftrag.id),
  })

  const detail: AuftragDetail | undefined = data?.data

  const billingName =
    detail?.billing_company ||
    [detail?.billing_first_name, detail?.billing_last_name].filter(Boolean).join(' ') ||
    'Unbekannt'

  const shippingName =
    detail?.shipping_company ||
    [detail?.shipping_first_name, detail?.shipping_last_name].filter(Boolean).join(' ') ||
    null

  const billingAddress = [detail?.billing_street, detail?.billing_postal_code, detail?.billing_city]
    .filter(Boolean)
    .join(', ')

  const shippingAddress = [detail?.shipping_street, detail?.shipping_postal_code, detail?.shipping_city]
    .filter(Boolean)
    .join(', ')

  // Check if shipping differs from billing
  const hasShipping = shippingAddress && shippingAddress !== billingAddress

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>#{auftrag.order_number}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{(error as Error).message}</Text>
        </View>
      ) : detail ? (
        <ScrollView contentContainerStyle={styles.content}>

          {/* Status + Datum */}
          <View style={styles.statusRow}>
            <StatusBadge status={detail.status} />
            <Text style={styles.dateText}>{formatDate(detail.order_date)}</Text>
          </View>

          {/* Kunde */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <User size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Kunde</Text>
            </View>
            <Text style={styles.primaryText}>{billingName}</Text>
            {detail.billing_city && (
              <View style={styles.infoRow}>
                <MapPin size={13} color={colors.textMuted} />
                <Text style={styles.infoText}>{billingAddress}</Text>
              </View>
            )}
            {detail.customer_number && (
              <Text style={styles.subText}>Kd.-Nr.: {detail.customer_number}</Text>
            )}
          </View>

          {/* Betraege */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Euro size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Beträge</Text>
            </View>
            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Netto</Text>
                <Text style={styles.gridValue}>{formatCurrency(detail.subtotal_net)}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Brutto</Text>
                <Text style={[styles.gridValue, styles.gridValuePrimary]}>{formatCurrency(detail.total_gross)}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Versand</Text>
                <Text style={styles.gridValue}>{formatCurrency(detail.shipping_cost)}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>MwSt.</Text>
                <Text style={styles.gridValue}>{formatCurrency(detail.tax_amount)}</Text>
              </View>
            </View>
          </View>

          {/* Positionen */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Package size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Positionen ({detail.items.length})</Text>
            </View>
            {detail.items.map((item: AuftragItem, index: number) => (
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
                    {item.quantity} {item.unit} × {formatCurrency(item.unit_price_gross)}
                  </Text>
                </View>
                <Text style={styles.positionTotal}>{formatCurrency(item.total_gross)}</Text>
              </View>
            ))}
          </View>

          {/* Lieferadresse (nur wenn abweichend) */}
          {hasShipping && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Truck size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Lieferadresse</Text>
              </View>
              {shippingName && <Text style={styles.primaryText}>{shippingName}</Text>}
              <View style={styles.infoRow}>
                <MapPin size={13} color={colors.textMuted} />
                <Text style={styles.infoText}>{shippingAddress}</Text>
              </View>
              {detail.shipping_country && (
                <Text style={styles.subText}>{detail.shipping_country}</Text>
              )}
            </View>
          )}

          {/* Notizen */}
          {detail.notes && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notizen</Text>
              <Text style={styles.notesText}>{detail.notes}</Text>
            </View>
          )}

        </ScrollView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
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
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
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
    gap: 8,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  subText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    width: '47%',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
  },
  gridLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  gridValuePrimary: {
    color: colors.primary,
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 8,
  },
  positionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  positionLeft: {
    width: 24,
    paddingTop: 2,
  },
  positionNumber: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  positionInfo: {
    flex: 1,
  },
  articleNumber: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  articleName: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 19,
  },
  positionCalc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
  },
  positionTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    paddingTop: 2,
  },
  notesText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
})
