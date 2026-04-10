import { useState, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, ScrollView, Alert, RefreshControl } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ShoppingCart, X, CheckCircle, Minus, Plus, PackageCheck } from 'lucide-react-native'
import { api, Auftrag, OrderItem } from '../lib/api'
import { getConnectionInfo } from '../lib/auth'
import { colors, spacing } from '../theme'
import { VersandWizard } from './VersandWizard'

interface AuftraegeScreenProps {
  onSelectAuftrag: (auftrag: Auftrag) => void
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  // Wenn nur Datum ohne Zeit (z.B. "2026-04-09"), keine Uhrzeit anzeigen
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())
  if (isDateOnly) {
    const [y, m, d] = dateStr.trim().split('-')
    return `${d}.${m}.${y}`
  }
  const dt = new Date(dateStr)
  if (isNaN(dt.getTime())) return ''
  const day = String(dt.getDate()).padStart(2, '0')
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const year = dt.getFullYear()
  const hours = String(dt.getHours()).padStart(2, '0')
  const mins = String(dt.getMinutes()).padStart(2, '0')
  if (hours === '00' && mins === '00') return `${day}.${month}.${year}`
  return `${day}.${month}.${year} ${hours}:${mins}`
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  new: { color: '#3b82f6', label: 'Offen' },
  offen: { color: '#3b82f6', label: 'Offen' },
  teilbestellt: { color: '#f59e0b', label: 'Teilbestellt' },
  bestellt: { color: '#22c55e', label: 'Bestellt' },
  storniert: { color: '#ef4444', label: 'Storniert' },
}

const INVOICE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  ohne_berechnung: { color: '#6b7280', label: 'O. Berechnung' },
  teilberechnet: { color: '#f59e0b', label: 'Teilberechnet' },
  berechnet: { color: '#22c55e', label: 'Berechnet' },
  storniert: { color: '#ef4444', label: 'Storniert' },
}

function StatusBadge({ status }: { status: string }) {
  const styles = createStyles()
  const config = STATUS_CONFIG[status.toLowerCase()] || { color: '#6b7280', label: status }
  return (
    <View style={[styles.badge, { backgroundColor: config.color + '25', borderColor: config.color + '50' }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  )
}

type OrderFilter = 'alle' | 'offen' | 'teilbestellt' | 'bestellt'
type InvoiceFilter = 'alle' | 'ohne_berechnung' | 'berechnet'
type TimeFilter = 7 | 30 | 90 | 365

const ORDER_FILTER_TABS: { key: OrderFilter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'offen', label: 'Offen' },
  { key: 'teilbestellt', label: 'Teilbest.' },
  { key: 'bestellt', label: 'Bestellt' },
]

const INVOICE_FILTER_TABS: { key: InvoiceFilter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'ohne_berechnung', label: 'O. Berechnung' },
  { key: 'berechnet', label: 'Berechnet' },
]

const TIME_FILTER_TABS: { key: TimeFilter; label: string }[] = [
  { key: 7, label: '7 Tage' },
  { key: 30, label: '30 Tage' },
  { key: 90, label: '90 Tage' },
  { key: 365, label: '365 Tage' },
]

const ORDER_FILTER_MAP: Record<OrderFilter, string[]> = {
  alle: ['offen', 'new', 'teilbestellt', 'bestellt', 'storniert'],
  offen: ['offen', 'new'],
  teilbestellt: ['teilbestellt'],
  bestellt: ['bestellt'],
}

const INVOICE_FILTER_MAP: Record<InvoiceFilter, string[]> = {
  alle: ['ohne_berechnung', 'teilberechnet', 'berechnet', 'storniert'],
  ohne_berechnung: ['ohne_berechnung'],
  berechnet: ['berechnet', 'teilberechnet'],
}

// Filter-State auf Modul-Ebene damit er beim Unmount/Remount erhalten bleibt
let _savedOrderFilter: OrderFilter = 'alle'
let _savedInvoiceFilter: InvoiceFilter = 'alle'
let _savedTimeFilter: TimeFilter = 30

export function AuftraegeScreen({ onSelectAuftrag }: AuftraegeScreenProps) {
  const styles = createStyles()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [orderFilter, setOrderFilterState] = useState<OrderFilter>(_savedOrderFilter)
  const [invoiceFilter, setInvoiceFilterState] = useState<InvoiceFilter>(_savedInvoiceFilter)
  const [timeFilter, setTimeFilterState] = useState<TimeFilter>(_savedTimeFilter)

  const setOrderFilter = (v: OrderFilter) => { _savedOrderFilter = v; setOrderFilterState(v) }
  const setInvoiceFilter = (v: InvoiceFilter) => { _savedInvoiceFilter = v; setInvoiceFilterState(v) }
  const setTimeFilter = (v: TimeFilter) => { _savedTimeFilter = v; setTimeFilterState(v) }

  const queryClient = useQueryClient()
  const [contextOrder, setContextOrder] = useState<Auftrag | null>(null)
  const [ekListeOrder, setEkListeOrder] = useState<Auftrag | null>(null)
  const [ekItems, setEkItems] = useState<(OrderItem & { selected: boolean; orderQty: number })[]>([])
  const [ekLoading, setEkLoading] = useState(false)
  const [ekSaving, setEkSaving] = useState(false)

  const [wizardOrder, setWizardOrder] = useState<Auftrag | null>(null)

  const handleSearch = useCallback((text: string) => {
    setSearch(text)
    const timeout = setTimeout(() => setDebouncedSearch(text), 300)
    return () => clearTimeout(timeout)
  }, [])

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['auftraege', debouncedSearch],
    queryFn: () => api.searchAuftraege(debouncedSearch, 500),
    staleTime: 30000,
  })

  const allAuftraege = data?.data || []
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - timeFilter)
  const cutoffIso = cutoffDate.toISOString()

  const auftraege = allAuftraege.filter((a: any) => {
    const status = (a.computed_status || a.status || 'offen').toLowerCase()
    const invStatus = (a.invoice_status || 'ohne_berechnung').toLowerCase()
    const matchesOrder = ORDER_FILTER_MAP[orderFilter].includes(status)
    const matchesInvoice = INVOICE_FILTER_MAP[invoiceFilter].includes(invStatus)
    const orderDate = a.order_date || a.created_at || ''
    const matchesTime = orderDate >= cutoffIso
    return matchesOrder && matchesInvoice && matchesTime
  })

  const openEkListe = async (order: Auftrag) => {
    setContextOrder(null)
    setEkListeOrder(order)
    setEkLoading(true)
    try {
      const res = await api.getOrderItemsForFulfillment(order.id)
      const items = (res?.items || []).filter((i: OrderItem) => i.item_type === 'artikel' || !i.item_type)
      setEkItems(items.map((i: OrderItem) => ({
        ...i,
        selected: true,
        orderQty: Math.max(0, Math.round(Number(i.quantity) - Number(i.quantity_fulfilled || 0))),
      })))
    } catch { setEkItems([]) }
    setEkLoading(false)
  }

  const submitEkListe = async () => {
    if (!ekListeOrder || ekSaving) return
    const selected = ekItems.filter(i => i.selected && i.orderQty > 0)
    if (selected.length === 0) { Alert.alert('Keine Positionen', 'Bitte mindestens eine Position auswaehlen.'); return }
    setEkSaving(true)
    try {
      const conn = await getConnectionInfo()
      if (!conn) throw new Error('Nicht verbunden')
      const batchRes = await fetch(`${conn.serverUrl}/api/mobile/versand/shopping-list/batch`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${conn.deviceToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selected.map(i => ({
            artikel_id: null,
            artikel_nummer: i.article_number,
            artikel_name: i.article_name,
            menge: i.orderQty,
            einheit: i.unit || 'Stk',
            order_id: ekListeOrder.id,
            order_number: ekListeOrder.order_number,
            supplier_id: i.default_supplier_id,
            supplier_name: i.default_supplier_name,
          })),
        }),
      })
      if (!batchRes.ok) throw new Error(`Fehler: ${batchRes.status}`)
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] })
      setEkListeOrder(null)
      Alert.alert('Einkaufsliste', `${selected.length} Position(en) hinzugefuegt.`)
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Fehlgeschlagen')
    }
    setEkSaving(false)
  }

  const handleCloseWithoutShipping = async (order: Auftrag) => {
    setContextOrder(null)
    Alert.alert(
      'Ohne Versand abschliessen',
      `Auftrag ${order.order_number} ohne Versand abschliessen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Abschliessen',
          onPress: async () => {
            try {
              await api.closeOrderWithoutShipping(order.id)
              queryClient.invalidateQueries({ queryKey: ['auftraege'] })
              Alert.alert('Erledigt', 'Auftrag wurde abgeschlossen.')
            } catch (e: any) {
              Alert.alert('Fehler', e?.message || 'Fehlgeschlagen')
            }
          },
        },
      ]
    )
  }

  const renderAuftrag = ({ item }: { item: Auftrag }) => {
    const customerName =
      item.customer_display_name ||
      item.billing_company ||
      [item.billing_first_name, item.billing_last_name].filter(Boolean).join(' ') ||
      'Unbekannt'

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onSelectAuftrag(item)}
        onLongPress={() => setContextOrder(item)}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <ShoppingCart size={18} color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.orderNumberRow}>
              <Text style={styles.orderNumber}>#{item.order_number}</Text>
              <Text style={styles.orderDate}>{formatDate((item as any).created_at || item.order_date)}</Text>
            </View>
            <Text style={styles.customerName} numberOfLines={1}>{customerName}</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardDetailText}>{item.items_count} Pos.</Text>
              <Text style={styles.cardDetailText}>{Math.round(Number((item as any).total_quantity) || 0)} Stk.</Text>
              <Text style={[styles.cardDetailText, styles.amount]}>{formatCurrency(item.total_gross)}</Text>
              <StatusBadge status={(item as any).computed_status || item.status} />
              {(item as any).invoice_status && (item as any).invoice_status !== 'ohne_berechnung' && (
                <View style={[styles.badge, { backgroundColor: '#22c55e25', borderColor: '#22c55e50' }]}>
                  <Text style={[styles.badgeText, { color: '#22c55e' }]}>
                    {INVOICE_STATUS_CONFIG[(item as any).invoice_status]?.label || (item as any).invoice_status}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  if (wizardOrder) {
    return (
      <VersandWizard
        auftrag={wizardOrder}
        onClose={() => setWizardOrder(null)}
        onComplete={() => {
          setWizardOrder(null)
          queryClient.invalidateQueries({ queryKey: ['auftraege'] })
        }}
      />
    )
  }

  return (
    <View style={styles.container}>
      {/* Zeitraum Filter */}
      <View style={styles.tabsTime}>
        {TIME_FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, timeFilter === tab.key && styles.tabTimeActive]}
            onPress={() => setTimeFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, timeFilter === tab.key && styles.tabTextTimeActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Bestell-Status Filter */}
      <View style={styles.tabs}>
        {ORDER_FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, orderFilter === tab.key && styles.tabActive]}
            onPress={() => setOrderFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, orderFilter === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Rechnungs-Status Filter */}
      <View style={styles.tabsSecondary}>
        {INVOICE_FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, invoiceFilter === tab.key && styles.tabSecondaryActive]}
            onPress={() => setInvoiceFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, invoiceFilter === tab.key && styles.tabTextSecondaryActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Auftraege suchen..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{(error as Error).message}</Text>
        </View>
      ) : auftraege.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {debouncedSearch ? 'Keine Auftraege gefunden' : 'Suchbegriff eingeben'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={auftraege}
          renderItem={renderAuftrag}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        />
      )}

      {/* Context Menu Modal */}
      <Modal visible={!!contextOrder} transparent animationType="fade" onRequestClose={() => setContextOrder(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setContextOrder(null)}>
          <View style={styles.contextMenu}>
            <View style={styles.contextHeader}>
              <Text style={styles.contextTitle} numberOfLines={1}>#{contextOrder?.order_number}</Text>
              <TouchableOpacity onPress={() => setContextOrder(null)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.contextItem} onPress={() => { setWizardOrder(contextOrder); setContextOrder(null) }}>
              <PackageCheck size={20} color={colors.primary} />
              <Text style={styles.contextItemText}>Ausliefern</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contextItem} onPress={() => contextOrder && openEkListe(contextOrder)}>
              <ShoppingCart size={20} color="#f59e0b" />
              <Text style={styles.contextItemText}>Auf Einkaufsliste</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contextItem} onPress={() => contextOrder && handleCloseWithoutShipping(contextOrder)}>
              <CheckCircle size={20} color="#22c55e" />
              <Text style={styles.contextItemText}>Ohne Versand abschliessen</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Einkaufsliste Modal */}
      <Modal visible={!!ekListeOrder} transparent animationType="slide" onRequestClose={() => setEkListeOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.ekModal}>
            <View style={styles.ekHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ekTitle}>Auf Einkaufsliste</Text>
                <Text style={styles.ekSubtitle}>#{ekListeOrder?.order_number}</Text>
              </View>
              <TouchableOpacity onPress={() => setEkListeOrder(null)}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {ekLoading ? (
              <View style={styles.ekCentered}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : ekItems.length === 0 ? (
              <View style={styles.ekCentered}>
                <Text style={styles.emptyText}>Keine Artikel-Positionen gefunden</Text>
              </View>
            ) : (
              <ScrollView style={styles.ekList} contentContainerStyle={{ paddingBottom: 16 }}>
                {ekItems.map((item, idx) => (
                  <View key={item.id} style={styles.ekItem}>
                    <TouchableOpacity
                      style={styles.ekCheckbox}
                      onPress={() => {
                        const updated = [...ekItems]
                        updated[idx] = { ...updated[idx], selected: !updated[idx].selected }
                        setEkItems(updated)
                      }}
                    >
                      <View style={[styles.checkboxBox, item.selected && styles.checkboxChecked]}>
                        {item.selected && <CheckCircle size={16} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                    <View style={styles.ekItemInfo}>
                      <Text style={styles.ekItemName} numberOfLines={2}>{item.article_name || item.article_number || 'Unbekannt'}</Text>
                      {item.article_number && <Text style={styles.ekItemArtNr}>{item.article_number}</Text>}
                      {item.default_supplier_name && <Text style={styles.ekItemSupplier}>{item.default_supplier_name}</Text>}
                      <Text style={styles.ekItemMeta}>
                        Bedarf: {item.quantity} {item.unit} | Bereits: {item.quantity_fulfilled || 0} {item.unit}
                      </Text>
                    </View>
                    <View style={styles.ekQtyControl}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => {
                          const updated = [...ekItems]
                          updated[idx] = { ...updated[idx], orderQty: Math.max(0, updated[idx].orderQty - 1) }
                          setEkItems(updated)
                        }}
                      >
                        <Minus size={14} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.orderQty}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => {
                          const updated = [...ekItems]
                          updated[idx] = { ...updated[idx], orderQty: updated[idx].orderQty + 1 }
                          setEkItems(updated)
                        }}
                      >
                        <Plus size={14} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.ekFooter}>
              <TouchableOpacity style={styles.ekCancelBtn} onPress={() => setEkListeOrder(null)}>
                <Text style={styles.ekCancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ekSubmitBtn, ekSaving && { opacity: 0.6 }]}
                onPress={submitEkListe}
                disabled={ekSaving}
              >
                {ekSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.ekSubmitText}>Hinzufuegen ({ekItems.filter(i => i.selected && i.orderQty > 0).length})</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  )
}

function createStyles() { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabsTime: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabsSecondary: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabTimeActive: {
    backgroundColor: '#6b7280',
  },
  tabSecondaryActive: {
    backgroundColor: '#22c55e',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tabTextTimeActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tabTextSecondaryActive: {
    color: '#fff',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: colors.text,
    fontSize: 16,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
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
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  cardInfo: {
    flex: 1,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  orderDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  customerName: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardDetailText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  amount: {
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
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  // Context Menu Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '80%',
    maxWidth: 320,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  contextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contextItemText: {
    fontSize: 15,
    color: colors.text,
    marginLeft: 14,
    fontWeight: '500',
  },
  // Einkaufsliste Modal
  ekModal: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    width: '92%',
    maxWidth: 420,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ekTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  ekSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  ekCentered: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ekList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  ekItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ekCheckbox: {
    marginRight: 10,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ekItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  ekItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  ekItemArtNr: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  ekItemSupplier: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 1,
  },
  ekItemMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ekQtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
  ekFooter: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  ekCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  ekCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  ekSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ekSubmitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
}) }
