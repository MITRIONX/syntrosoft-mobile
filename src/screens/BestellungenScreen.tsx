import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Modal, ScrollView, Alert } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Package, Warehouse, ArrowRightLeft, X, Minus, Plus, PackageCheck } from 'lucide-react-native'
import { api, PurchaseOrder, PurchaseOrderItem } from '../lib/api'
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

type TypeFilter = 'alle' | 'dropship' | 'lager'

const FILTER_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'dropship', label: 'Strecke' },
  { key: 'lager', label: 'Lager' },
]

export function BestellungenScreen() {
  const styles = createStyles()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [activeFilter, setActiveFilter] = useState<TypeFilter>('alle')
  const [contextOrder, setContextOrder] = useState<PurchaseOrder | null>(null)
  const [weOrder, setWeOrder] = useState<PurchaseOrder | null>(null)
  const [weItems, setWeItems] = useState<(PurchaseOrderItem & { receiveQty: number })[]>([])
  const [weLoading, setWeLoading] = useState(false)
  const [weSaving, setWeSaving] = useState(false)
  const queryClient = useQueryClient()

  const handleSearch = useCallback((text: string) => {
    setSearch(text)
    const timeout = setTimeout(() => setDebouncedSearch(text), 300)
    return () => clearTimeout(timeout)
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', debouncedSearch],
    queryFn: () => api.searchPurchaseOrders({
      search: debouncedSearch || undefined,
      limit: 200,
    }),
  })

  const allOrders = Array.isArray(data?.data) ? data.data : []
  const orders = allOrders.filter((o: any) => {
    if (activeFilter === 'alle') return true
    if (activeFilter === 'dropship') return o.is_dropshipping === 1 || o.is_dropshipping === true
    return o.is_dropshipping === 0 || o.is_dropshipping === false
  })

  const openWareneingang = async (order: PurchaseOrder) => {
    setContextOrder(null)
    setWeOrder(order)
    setWeLoading(true)
    try {
      const res = await api.getPurchaseOrderItems(order.id)
      const items = Array.isArray(res?.data) ? res.data : []
      setWeItems(items.filter(i => !i.item_type || i.item_type === 'artikel').map(i => ({
        ...i,
        receiveQty: Math.max(0, Math.round(Number(i.quantity) - Number(i.quantity_delivered || 0))),
      })))
    } catch { setWeItems([]) }
    setWeLoading(false)
  }

  const submitWareneingang = async () => {
    if (!weOrder || weSaving) return
    const itemsToReceive = weItems.filter(i => i.receiveQty > 0)
    if (itemsToReceive.length === 0) { Alert.alert('Keine Menge', 'Bitte mindestens eine Menge eingeben.'); return }
    setWeSaving(true)
    try {
      await api.createGoodsReceipt({
        purchase_order_id: weOrder.id,
        items: itemsToReceive.map(i => ({ purchase_order_item_id: i.id, quantity: i.receiveQty })),
      })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order-items', weOrder.id] })
      setWeOrder(null)
      Alert.alert('Wareneingang gebucht', `${itemsToReceive.length} Position(en) eingebucht.`)
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Wareneingang fehlgeschlagen')
    }
    setWeSaving(false)
  }

  const updateReceiveQty = (itemId: number, delta: number) => {
    setWeItems(prev => prev.map(i => i.id === itemId ? { ...i, receiveQty: Math.max(0, i.receiveQty + delta) } : i))
  }

  if (selectedOrder) {
    return <BestellungDetailScreen order={selectedOrder} onBack={() => setSelectedOrder(null)} />
  }

  const renderOrder = ({ item }: { item: PurchaseOrder }) => {
    const delivered = (item.qty_delivered || 0)
    const total = (item.qty_total || 0)
    const isComplete = total > 0 && delivered >= total
    const statusColor = isComplete ? '#22c55e' : delivered > 0 ? '#f59e0b' : '#3b82f6'
    const statusText = item.status_text || (isComplete ? 'Geliefert' : delivered > 0 ? 'Teillieferung' : 'Bestellt')
    const isDropship = item.is_dropshipping === 1 || (item as any).is_dropshipping === true
    const TypeIcon = isDropship ? ArrowRightLeft : Warehouse
    const typeColor = isDropship ? '#a855f7' : '#3b82f6'

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelectedOrder(item)}
        onLongPress={() => !isDropship && setContextOrder(item)}
        activeOpacity={0.7}
        delayLongPress={400}
      >
        <View style={styles.cardTop}>
          <View style={[styles.typeIcon, { backgroundColor: typeColor + '15' }]}>
            <TypeIcon size={16} color={typeColor} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.orderRow}>
              <Text style={styles.orderNumber}>{item.order_number}</Text>
              <Text style={styles.date}>{formatDate(item.order_date)}</Text>
            </View>
            <Text style={styles.supplier} numberOfLines={1}>{item.supplier_name || 'Unbekannt'}</Text>
            {((item as any).delivery_company || item.warehouse_name) && (
              <Text style={styles.destination} numberOfLines={1}>→ {isDropship ? (item as any).delivery_company : item.warehouse_name}{(item as any).delivery_city ? `, ${(item as any).delivery_city}` : ''}</Text>
            )}
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
      <View style={styles.tabs}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeFilter === tab.key && styles.tabActive]}
            onPress={() => setActiveFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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

      {/* Kontext-Menü (Long Press) */}
      <Modal visible={!!contextOrder} transparent animationType="fade" onRequestClose={() => setContextOrder(null)}>
        <TouchableOpacity style={styles.contextOverlay} activeOpacity={1} onPress={() => setContextOrder(null)}>
          <View style={styles.contextMenu}>
            <TouchableOpacity style={styles.contextItem} onPress={() => contextOrder && openWareneingang(contextOrder)}>
              <PackageCheck size={18} color={colors.primary} />
              <Text style={styles.contextText}>Wareneingang buchen</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Wareneingang Modal */}
      <Modal visible={!!weOrder} transparent animationType="slide" onRequestClose={() => setWeOrder(null)}>
        <View style={styles.weOverlay}>
          <View style={styles.weContent}>
            <View style={styles.weHeader}>
              <View>
                <Text style={styles.weTitle}>Wareneingang</Text>
                <Text style={styles.weSubtitle}>{weOrder?.order_number} — {weOrder?.supplier_name}</Text>
              </View>
              <TouchableOpacity onPress={() => setWeOrder(null)}><X size={22} color={colors.text} /></TouchableOpacity>
            </View>

            {weLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} />
            ) : (
              <ScrollView style={styles.weList}>
                {weItems.map(item => {
                  const open = Math.max(0, Math.round(Number(item.quantity) - Number(item.quantity_delivered || 0)))
                  return (
                    <View key={item.id} style={styles.weItem}>
                      <View style={styles.weItemInfo}>
                        {item.article_number && <Text style={styles.weItemArtNr}>{item.article_number}</Text>}
                        <Text style={styles.weItemName} numberOfLines={2}>{item.article_name || '-'}</Text>
                        <Text style={styles.weItemMeta}>Bestellt: {Math.round(Number(item.quantity))} | Geliefert: {Math.round(Number(item.quantity_delivered || 0))} | Offen: {open}</Text>
                      </View>
                      <View style={styles.weQtyRow}>
                        <TouchableOpacity style={styles.weQtyBtn} onPress={() => updateReceiveQty(item.id, -1)}>
                          <Minus size={16} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.weQtyValue, item.receiveQty > 0 && { color: colors.primary }]}>{item.receiveQty}</Text>
                        <TouchableOpacity style={styles.weQtyBtn} onPress={() => updateReceiveQty(item.id, 1)}>
                          <Plus size={16} color={colors.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.weSubmit, weSaving && { opacity: 0.5 }]}
              onPress={submitWareneingang}
              disabled={weSaving}
              activeOpacity={0.7}
            >
              <PackageCheck size={18} color="#fff" />
              <Text style={styles.weSubmitText}>{weSaving ? 'Wird gebucht...' : 'Wareneingang buchen'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createStyles() { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, margin: spacing.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, height: 44, color: colors.text, fontSize: 15 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', marginBottom: 6, alignItems: 'center' },
  typeIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 15, fontWeight: '600', color: colors.text },
  date: { fontSize: 11, color: colors.textMuted },
  supplier: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  destination: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  detail: { fontSize: 12, color: colors.textMuted },
  amount: { fontWeight: '600', color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  reference: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  // Kontext-Menü
  contextOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  contextMenu: { backgroundColor: colors.surface, borderRadius: 12, padding: 8, minWidth: 220, borderWidth: 1, borderColor: colors.border },
  contextItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  contextText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  // Wareneingang Modal
  weOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  weContent: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%', paddingBottom: 30 },
  weHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  weTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  weSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  weList: { paddingHorizontal: spacing.md, maxHeight: 400 },
  weItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  weItemInfo: { flex: 1 },
  weItemArtNr: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  weItemName: { fontSize: 14, fontWeight: '500', color: colors.text, marginTop: 1 },
  weItemMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },
  weQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 10 },
  weQtyBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.surfaceHover, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  weQtyValue: { fontSize: 18, fontWeight: '700', color: colors.text, minWidth: 36, textAlign: 'center' },
  weSubmit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, marginHorizontal: spacing.md, marginTop: spacing.md, paddingVertical: 14, borderRadius: 12 },
  weSubmitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
}) }
