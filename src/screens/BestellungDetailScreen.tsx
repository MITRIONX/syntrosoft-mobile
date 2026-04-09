import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Package } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { api, PurchaseOrder, PurchaseOrderItem } from '../lib/api'
import { colors, spacing } from '../theme'

interface Props {
  order: PurchaseOrder
  onBack: () => void
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '0,00 €'
  return Number(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function BestellungDetailScreen({ order, onBack }: Props) {
  if (!order) return null
  const styles = createStyles()
  const insets = useSafeAreaInsets()

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-order-items', order.id],
    queryFn: () => api.getPurchaseOrderItems(order.id),
  })

  const items = data?.data || []
  const artikelItems = items.filter(i => i.item_type === 'artikel' || !i.item_type)

  const delivered = order.qty_delivered || 0
  const total = order.qty_total || 0
  const isComplete = total > 0 && delivered >= total
  const statusColor = isComplete ? '#22c55e' : delivered > 0 ? '#f59e0b' : '#3b82f6'
  const statusText = order.status_text || (isComplete ? 'Geliefert' : delivered > 0 ? 'Teillieferung' : 'Bestellt')

  const renderItem = ({ item, index }: { item: PurchaseOrderItem; index: number }) => {
    const deliveredQty = item.quantity_delivered || 0
    const isItemComplete = deliveredQty >= item.quantity
    const itemColor = isItemComplete ? '#22c55e' : deliveredQty > 0 ? '#f59e0b' : colors.textMuted
    return (
      <View style={styles.itemRow}>
        <Text style={styles.itemPos}>{index + 1}.</Text>
        <View style={styles.itemInfo}>
          {item.article_number && <Text style={styles.itemArtNr}>{item.article_number}</Text>}
          <Text style={styles.itemName} numberOfLines={2}>{item.article_name || '-'}</Text>
          <Text style={styles.itemDetail}>
            {item.quantity} Stk. × {formatCurrency(item.unit_price_net)}
            {deliveredQty > 0 && <Text style={{ color: itemColor }}> — {deliveredQty}/{item.quantity} geliefert</Text>}
          </Text>
        </View>
        <Text style={styles.itemPrice}>{formatCurrency(item.total_net)}</Text>
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

      {/* Meta */}
      <View style={styles.metaBar}>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: statusColor + '25' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{statusText}</Text>
          </View>
          <Text style={styles.metaDate}>{formatDate(order.order_date)}</Text>
        </View>
        <Text style={styles.supplier}>{order.supplier_name || 'Unbekannt'}</Text>
        {order.reference_order_number && <Text style={styles.reference}>Auftrag: {order.reference_order_number}</Text>}
      </View>

      {/* Beträge */}
      <View style={styles.amountBar}>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>NETTO</Text>
          <Text style={styles.amountValue}>{formatCurrency(order.total_net)}</Text>
        </View>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>BRUTTO</Text>
          <Text style={[styles.amountValue, { color: colors.primary }]}>{formatCurrency(order.total_gross)}</Text>
        </View>
        {total > 0 && (
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>GELIEFERT</Text>
            <Text style={[styles.amountValue, { color: statusColor }]}>{delivered} / {total}</Text>
          </View>
        )}
      </View>

      {/* Positionen */}
      <View style={styles.sectionHeader}>
        <Package size={16} color={colors.primary} />
        <Text style={styles.sectionTitle}>Positionen ({artikelItems.length})</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={artikelItems}
          renderItem={renderItem}
          keyExtractor={item => String(item.id)}
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
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, flex: 1 },
  metaBar: { backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  metaDate: { fontSize: 12, color: colors.textMuted },
  supplier: { fontSize: 14, fontWeight: '500', color: colors.text },
  reference: { fontSize: 12, color: colors.textMuted },
  amountBar: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: 12, gap: 8 },
  amountItem: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border },
  amountLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 4 },
  amountValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  itemRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemPos: { width: 28, fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  itemInfo: { flex: 1 },
  itemArtNr: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  itemName: { fontSize: 14, fontWeight: '500', color: colors.text, marginTop: 1 },
  itemDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: colors.primary, marginLeft: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
}) }
