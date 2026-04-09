import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Package, CheckCircle, Clock, Truck } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { api, PurchaseOrder, PurchaseOrderItem } from '../lib/api'
import { colors, spacing } from '../theme'

interface Props {
  order: PurchaseOrder
  onBack: () => void
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '0,00 €'
  return Number(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
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

export function BestellungDetailScreen({ order, onBack }: Props) {
  const styles = createStyles()
  const insets = useSafeAreaInsets()

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-order-items', order.id],
    queryFn: () => api.getPurchaseOrderItems(order.id),
  })

  const items = Array.isArray(data?.data) ? data.data : []
  const artikelItems = items.filter(i => !i.item_type || i.item_type === 'artikel')

  const delivered = Number(order.qty_delivered) || 0
  const total = Number(order.qty_total) || 0
  const isComplete = total > 0 && delivered >= total
  const hasPartial = delivered > 0 && !isComplete
  const statusColor = isComplete ? '#22c55e' : hasPartial ? '#f59e0b' : '#3b82f6'
  const statusText = order.status_text || (isComplete ? 'Geliefert' : hasPartial ? 'Teillieferung' : 'Bestellt')
  const StatusIcon = isComplete ? CheckCircle : hasPartial ? Truck : Clock

  const renderHeader = () => (
    <>
      {/* Status + Meta */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
            <StatusIcon size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(order.order_date)}</Text>
        </View>
        <Text style={styles.supplierName}>{order.supplier_name || 'Unbekannt'}</Text>
        {order.reference_order_number && (
          <Text style={styles.refText}>Auftrag: {order.reference_order_number}</Text>
        )}
      </View>

      {/* Beträge */}
      <View style={styles.amountGrid}>
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>NETTO</Text>
          <Text style={styles.amountValue}>{formatCurrency(order.total_net)}</Text>
        </View>
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>BRUTTO</Text>
          <Text style={[styles.amountValue, { color: colors.primary }]}>{formatCurrency(order.total_gross)}</Text>
        </View>
      </View>

      {/* Lieferfortschritt */}
      {total > 0 && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Lieferfortschritt</Text>
            <Text style={[styles.progressCount, { color: statusColor }]}>{Math.round(delivered)} / {Math.round(total)} Stk.</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, {
              width: `${Math.min(100, (delivered / total) * 100)}%` as any,
              backgroundColor: statusColor,
            }]} />
          </View>
        </View>
      )}

      {/* Positionen Header */}
      <View style={styles.sectionHeader}>
        <Package size={16} color={colors.primary} />
        <Text style={styles.sectionTitle}>Positionen ({artikelItems.length})</Text>
      </View>
    </>
  )

  const renderItem = ({ item, index }: { item: PurchaseOrderItem; index: number }) => {
    const dQty = Number(item.quantity_delivered) || 0
    const qty = Number(item.quantity) || 0
    const itemComplete = qty > 0 && dQty >= qty
    const itemPartial = dQty > 0 && !itemComplete
    const itemColor = itemComplete ? '#22c55e' : itemPartial ? '#f59e0b' : colors.textMuted

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemTop}>
          <Text style={styles.itemPos}>{index + 1}.</Text>
          <View style={styles.itemInfo}>
            {item.article_number && <Text style={styles.itemArtNr}>{item.article_number}</Text>}
            <Text style={styles.itemName} numberOfLines={2}>{item.article_name || '-'}</Text>
          </View>
          <Text style={styles.itemPrice}>{formatCurrency(item.total_net)}</Text>
        </View>
        <View style={styles.itemBottom}>
          <Text style={styles.itemCalc}>{Math.round(qty)} × {formatCurrency(item.unit_price_net)}</Text>
          {dQty > 0 && (
            <View style={[styles.deliveryBadge, { backgroundColor: itemColor + '20' }]}>
              <Text style={[styles.deliveryText, { color: itemColor }]}>
                {itemComplete ? '✓ Geliefert' : `${Math.round(dQty)}/${Math.round(qty)} geliefert`}
              </Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{order.order_number}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={artikelItems}
          keyExtractor={item => String(item.id)}
          ListHeaderComponent={renderHeader}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

function createStyles() { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  list: { paddingBottom: spacing.xl },

  // Status Card
  statusCard: { backgroundColor: colors.surface, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 13, fontWeight: '600' },
  dateText: { fontSize: 12, color: colors.textMuted },
  supplierName: { fontSize: 16, fontWeight: '600', color: colors.text },
  refText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },

  // Beträge
  amountGrid: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 8 },
  amountBox: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  amountLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  amountValue: { fontSize: 18, fontWeight: '700', color: colors.text },

  // Progress
  progressCard: { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  progressCount: { fontSize: 14, fontWeight: '700' },
  progressBarBg: { height: 8, backgroundColor: colors.surfaceHover, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4 },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Items
  itemCard: { marginHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start' },
  itemPos: { width: 28, fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  itemInfo: { flex: 1 },
  itemArtNr: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  itemName: { fontSize: 14, fontWeight: '500', color: colors.text, marginTop: 1 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: colors.primary, marginLeft: 8 },
  itemBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingLeft: 28 },
  itemCalc: { fontSize: 12, color: colors.textSecondary },
  deliveryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  deliveryText: { fontSize: 11, fontWeight: '600' },
}) }
