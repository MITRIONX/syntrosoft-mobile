import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft } from 'lucide-react-native'
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

export function BestellungDetailScreen({ order, onBack }: Props) {
  const styles = createStyles()
  const insets = useSafeAreaInsets()

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-order-items', order.id],
    queryFn: () => api.getPurchaseOrderItems(order.id),
  })

  const items = Array.isArray(data?.data) ? data.data : []

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={{ padding: 8, marginRight: 8 }}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{order.order_number}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.supplier}>{order.supplier_name || 'Unbekannt'}</Text>
        <Text style={styles.meta}>{order.items_count || 0} Pos. — {formatCurrency(order.total_net)}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{String((error as Error)?.message || 'Fehler')}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item, index }) => (
            <View style={styles.itemRow}>
              <Text style={styles.itemPos}>{index + 1}.</Text>
              <View style={{ flex: 1 }}>
                {item.article_number && <Text style={styles.itemArtNr}>{item.article_number}</Text>}
                <Text style={styles.itemName} numberOfLines={2}>{item.article_name || '-'}</Text>
                <Text style={styles.itemDetail}>{Math.round(item.quantity)} × {formatCurrency(item.unit_price_net)}</Text>
              </View>
              <Text style={styles.itemPrice}>{formatCurrency(item.total_net)}</Text>
            </View>
          )}
        />
      )}
    </View>
  )
}

function createStyles() { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, flex: 1 },
  info: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  supplier: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  itemRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemPos: { width: 28, fontSize: 13, color: colors.textMuted },
  itemArtNr: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  itemName: { fontSize: 14, fontWeight: '500', color: colors.text, marginTop: 1 },
  itemDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: colors.primary, marginLeft: 8 },
}) }
