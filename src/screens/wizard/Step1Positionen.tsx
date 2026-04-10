import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { api, Auftrag, OrderItem, OrderItemSupplier } from '../../lib/api'
import { colors, spacing } from '../../theme'
import { FulfillmentItem } from '../VersandWizard'

interface Props {
  auftrag: Auftrag
  items: FulfillmentItem[]
  onItemsLoaded: (items: FulfillmentItem[]) => void
  onNext: () => void
}

type FulfillType = FulfillmentItem['fulfillType']

const SEGMENT_COLORS: Record<FulfillType, string> = {
  eigen: '#3b82f6',
  strecke: '#a855f7',
  ekliste: '#f59e0b',
  produktion: '#ec4899',
  skip: '#6b7280',
}

const SEGMENT_LABELS: { type: FulfillType; label: string }[] = [
  { type: 'eigen', label: 'Eigen' },
  { type: 'strecke', label: 'Strecke' },
  { type: 'ekliste', label: 'EK' },
  { type: 'produktion', label: 'Prod.' },
  { type: 'skip', label: 'Skip' },
]

function autoSelectType(item: OrderItem): FulfillType {
  // Check if it's a production article (has a produktions_artikel_id-like field)
  if ((item as any).produktions_artikel_id) return 'produktion'
  const stock = item.stock_total ?? 0
  const openQty = item.quantity - (item.quantity_fulfilled ?? 0)
  if (stock >= openQty && openQty > 0) return 'eigen'
  if (item.default_supplier_id) return 'strecke'
  return 'ekliste'
}

function toFulfillmentItem(item: OrderItem): FulfillmentItem {
  const openQty = Math.max(0, item.quantity - (item.quantity_fulfilled ?? 0))
  return {
    ...item,
    fulfillType: autoSelectType(item),
    liefermenge: openQty,
    supplierId: item.default_supplier_id,
    supplierName: item.default_supplier_name,
  }
}

export function Step1Positionen({ auftrag, items, onItemsLoaded, onNext }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localItems, setLocalItems] = useState<FulfillmentItem[]>(items)

  useEffect(() => {
    if (items.length > 0) {
      setLocalItems(items)
      return
    }
    setLoading(true)
    api.getOrderItemsForFulfillment(auftrag.id)
      .then(res => {
        const filtered = (res.items || []).filter(
          (i: OrderItem) => !i.item_type || i.item_type === 'artikel'
        )
        const mapped = filtered.map(toFulfillmentItem)
        setLocalItems(mapped)
        onItemsLoaded(mapped)
      })
      .catch(e => setError(e.message || 'Fehler beim Laden'))
      .finally(() => setLoading(false))
  }, [])

  function updateItem(index: number, changes: Partial<FulfillmentItem>) {
    setLocalItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...changes }
      onItemsLoaded(next)
      return next
    })
  }

  function changeType(index: number, type: FulfillType) {
    const item = localItems[index]
    const defaultSupplier = item.suppliers?.find(s => s.is_default) || item.suppliers?.[0]
    updateItem(index, {
      fulfillType: type,
      supplierId: type === 'strecke' ? (item.supplierId ?? defaultSupplier?.id ?? null) : item.supplierId,
      supplierName: type === 'strecke' ? (item.supplierName ?? defaultSupplier?.name ?? null) : item.supplierName,
    })
  }

  function changeQty(index: number, delta: number) {
    const item = localItems[index]
    const openQty = Math.max(0, item.quantity - (item.quantity_fulfilled ?? 0))
    const next = Math.min(openQty, Math.max(1, item.liefermenge + delta))
    updateItem(index, { liefermenge: next })
  }

  function selectSupplier(index: number, supplier: OrderItemSupplier) {
    updateItem(index, { supplierId: supplier.id, supplierName: supplier.name })
  }

  const activeCount = localItems.filter(i => i.fulfillType !== 'skip').length

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Positionen werden geladen...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {localItems.map((item, index) => {
          const openQty = Math.max(0, item.quantity - (item.quantity_fulfilled ?? 0))
          const activeColor = SEGMENT_COLORS[item.fulfillType]
          return (
            <View key={item.id} style={styles.card}>
              {/* Article info */}
              <View style={styles.cardHeader}>
                <Text style={styles.articleNumber}>{item.article_number || '—'}</Text>
                <Text style={styles.articleName} numberOfLines={2}>{item.article_name || '—'}</Text>
              </View>

              {/* Stock info */}
              <View style={styles.stockRow}>
                <Text style={styles.stockLabel}>Bedarf: <Text style={styles.stockValue}>{openQty}</Text></Text>
                <Text style={styles.stockDivider}>|</Text>
                <Text style={styles.stockLabel}>Lager: <Text style={[
                  styles.stockValue,
                  { color: (item.stock_total ?? 0) >= openQty ? colors.success : colors.warning }
                ]}>{item.stock_total ?? 0}</Text></Text>
              </View>

              {/* Segment buttons */}
              <View style={styles.segments}>
                {SEGMENT_LABELS.map(seg => {
                  const isActive = item.fulfillType === seg.type
                  const segColor = SEGMENT_COLORS[seg.type]
                  return (
                    <TouchableOpacity
                      key={seg.type}
                      style={[
                        styles.segBtn,
                        isActive
                          ? { backgroundColor: segColor, borderColor: segColor }
                          : { backgroundColor: 'transparent', borderColor: colors.border },
                      ]}
                      onPress={() => changeType(index, seg.type)}
                    >
                      <Text style={[
                        styles.segLabel,
                        { color: isActive ? '#fff' : colors.textSecondary },
                      ]}>
                        {seg.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Quantity row */}
              {item.fulfillType !== 'skip' && (
                <View style={styles.qtyRow}>
                  <Text style={styles.qtyLabel}>Menge:</Text>
                  <TouchableOpacity
                    style={[styles.qtyBtn, item.liefermenge <= 1 && styles.qtyBtnDisabled]}
                    onPress={() => changeQty(index, -1)}
                    disabled={item.liefermenge <= 1}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.qtyValue, { color: activeColor }]}>{item.liefermenge}</Text>
                  <TouchableOpacity
                    style={[styles.qtyBtn, item.liefermenge >= openQty && styles.qtyBtnDisabled]}
                    onPress={() => changeQty(index, +1)}
                    disabled={item.liefermenge >= openQty}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Supplier chips (only for strecke) */}
              {item.fulfillType === 'strecke' && item.suppliers && item.suppliers.length > 0 && (
                <View style={styles.supplierRow}>
                  {item.suppliers.map(sup => {
                    const isSelected = item.supplierId === sup.id
                    return (
                      <TouchableOpacity
                        key={sup.id}
                        style={[
                          styles.supplierChip,
                          isSelected && { backgroundColor: '#a855f720', borderColor: '#a855f7' },
                        ]}
                        onPress={() => selectSupplier(index, sup)}
                      >
                        <Text style={[
                          styles.supplierChipText,
                          { color: isSelected ? '#a855f7' : colors.textSecondary },
                        ]}>
                          {sup.name}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerCount}>
          {activeCount} {activeCount === 1 ? 'Position' : 'Positionen'} aktiv
        </Text>
        <TouchableOpacity
          style={[styles.nextBtn, activeCount === 0 && styles.nextBtnDisabled]}
          onPress={onNext}
          disabled={activeCount === 0}
        >
          <Text style={styles.nextBtnText}>Weiter →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    gap: 2,
  },
  articleNumber: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  articleName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  stockRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  stockLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  stockValue: {
    fontWeight: '600',
  },
  stockDivider: {
    color: colors.border,
    fontSize: 12,
  },
  segments: {
    flexDirection: 'row',
    gap: 5,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  segLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: {
    opacity: 0.35,
  },
  qtyBtnText: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '500',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },
  supplierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  supplierChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  supplierChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerCount: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  nextBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  nextBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
})
