import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { CheckCircle, Printer, Package, Truck, ShoppingCart, Settings } from 'lucide-react-native'
import { api, Auftrag } from '../../lib/api'
import { colors, spacing } from '../../theme'
import { FulfillmentItem, CreatedLabel } from '../VersandWizard'
import { printWithContext } from '../../lib/printer'
import { useQueryClient } from '@tanstack/react-query'
import { getConnectionInfo } from '../../lib/auth'

interface Props {
  auftrag: Auftrag
  items: FulfillmentItem[]
  labels: CreatedLabel[]
  onComplete: () => void
}

interface DruckVorlage {
  id: number
  name: string
  document_type: string
  is_default: boolean
}

export function Step3Abschluss({ auftrag, items, labels, onComplete }: Props) {
  const styles = createStyles()
  const queryClient = useQueryClient()
  const [templates, setTemplates] = useState<DruckVorlage[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const eigenItems = items.filter(i => i.fulfillType === 'eigen')
  const streckeItems = items.filter(i => i.fulfillType === 'strecke')
  const ekItems = items.filter(i => i.fulfillType === 'ekliste')
  const prodItems = items.filter(i => i.fulfillType === 'produktion')

  useEffect(() => {
    api.getDruckvorlagen('lieferschein')
      .then(res => {
        if (res.success && res.data) {
          setTemplates(res.data)
          const def = res.data.find(t => t.is_default)
          if (def) setSelectedTemplate(def.id)
        }
      })
      .catch(() => {})
  }, [])

  async function handleAusliefern() {
    setLoading(true)
    try {
      // 1. Build fulfillments and call completeOrderFulfillment
      const fulfillments: { orderItemId: number; fulfillmentType: string; quantity: number; supplierId?: number }[] = []

      for (const item of eigenItems) {
        fulfillments.push({
          orderItemId: item.id,
          fulfillmentType: 'eigenversand',
          quantity: item.liefermenge,
          ...(labels[0]?.id ? { shippingLabelId: labels[0].id } as any : {}),
        })
      }

      for (const item of streckeItems) {
        fulfillments.push({
          orderItemId: item.id,
          fulfillmentType: 'dropshipping',
          quantity: item.liefermenge,
          supplierId: item.supplierId ?? undefined,
        })
      }

      for (const item of prodItems) {
        fulfillments.push({
          orderItemId: item.id,
          fulfillmentType: 'produktion',
          quantity: item.liefermenge,
        })
      }

      if (fulfillments.length > 0) {
        await api.completeOrderFulfillment(auftrag.id, fulfillments)
      }

      // 2. EK-Liste items → POST to shopping-list batch endpoint
      if (ekItems.length > 0) {
        const conn = await getConnectionInfo()
        if (conn) {
          await fetch(`${conn.serverUrl}/api/mobile/versand/shopping-list/batch`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${conn.deviceToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              items: ekItems.map(i => ({
                artikel_nummer: i.article_number,
                artikel_name: i.article_name,
                menge: i.liefermenge,
                einheit: i.unit || 'Stk',
                order_id: auftrag.id,
                order_number: auftrag.order_number,
                supplier_id: i.default_supplier_id,
                supplier_name: i.default_supplier_name,
              })),
            }),
          })
        }
      }

      // 3. Print Lieferschein if template selected
      if (selectedTemplate) {
        const renderRes = await api.renderDruckvorlage({
          templateId: selectedTemplate,
          orderId: auftrag.id,
          paperWidth: 102,
        })
        if (renderRes.success && renderRes.pdf) {
          await printWithContext('doctype:lieferschein', renderRes.pdf)
        }
      }

      // 4. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['auftraege'] })
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] })

      // 5. Show done screen
      setDone(true)
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Unbekannter Fehler beim Ausliefern')
    } finally {
      setLoading(false)
    }
  }

  // Done screen
  if (done) {
    return (
      <View style={styles.doneContainer}>
        <CheckCircle size={64} color={colors.success} />
        <Text style={styles.doneTitle}>Auslieferung abgeschlossen</Text>
        <Text style={styles.doneOrderNumber}>{auftrag.order_number}</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={onComplete}>
          <Text style={styles.doneBtnText}>Fertig</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Summary sections */}
        {eigenItems.length > 0 && (
          <SummarySection
            icon={<Truck size={16} color="#3b82f6" />}
            title="Eigenversand"
            color="#3b82f6"
            items={eigenItems}
            labels={labels}
          />
        )}

        {streckeItems.length > 0 && (
          <SummarySection
            icon={<Package size={16} color="#a855f7" />}
            title="Strecke / Dropshipping"
            color="#a855f7"
            items={streckeItems}
          />
        )}

        {ekItems.length > 0 && (
          <SummarySection
            icon={<ShoppingCart size={16} color="#f59e0b" />}
            title="Einkaufsliste"
            color="#f59e0b"
            items={ekItems}
          />
        )}

        {prodItems.length > 0 && (
          <SummarySection
            icon={<Settings size={16} color="#ec4899" />}
            title="Produktion"
            color="#ec4899"
            items={prodItems}
          />
        )}

        {/* Lieferschein template selection */}
        {templates.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Printer size={16} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>Lieferschein-Vorlage</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
              <TouchableOpacity
                style={[
                  styles.templateChip,
                  selectedTemplate === null && styles.templateChipActive,
                ]}
                onPress={() => setSelectedTemplate(null)}
              >
                <Text style={[
                  styles.templateChipText,
                  selectedTemplate === null && styles.templateChipTextActive,
                ]}>
                  Kein Druck
                </Text>
              </TouchableOpacity>
              {templates.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.templateChip,
                    selectedTemplate === t.id && styles.templateChipActive,
                  ]}
                  onPress={() => setSelectedTemplate(t.id)}
                >
                  <Text style={[
                    styles.templateChipText,
                    selectedTemplate === t.id && styles.templateChipTextActive,
                  ]}>
                    {t.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Footer: Ausliefern button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleAusliefern}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Ausliefern</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

interface SummarySectionProps {
  icon: React.ReactNode
  title: string
  color: string
  items: FulfillmentItem[]
  labels?: CreatedLabel[]
}

function SummarySection({ icon, title, color, items, labels }: SummarySectionProps) {
  const styles = createStyles()
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        <View style={[styles.badge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.badgeText, { color }]}>{items.length}</Text>
        </View>
      </View>

      {items.map(item => (
        <View key={item.id} style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemNumber}>{item.article_number || '—'}</Text>
            <Text style={styles.itemName} numberOfLines={1}>{item.article_name || '—'}</Text>
            {item.supplierName && (
              <Text style={styles.itemSupplier}>{item.supplierName}</Text>
            )}
          </View>
          <View style={styles.itemMeta}>
            <Text style={[styles.itemQty, { color }]}>{item.liefermenge} {item.unit || 'Stk'}</Text>
          </View>
        </View>
      ))}

      {/* Tracking numbers from labels */}
      {labels && labels.length > 0 && (
        <View style={styles.labelsSection}>
          {labels.map(label => (
            <View key={label.id} style={styles.labelRow}>
              <Text style={styles.labelCarrier}>{label.carrier}</Text>
              <Text style={styles.labelTracking}>{label.trackingNumber}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function createStyles() {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemNumber: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  itemName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  itemSupplier: {
    color: colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
  },
  itemMeta: {
    alignItems: 'flex-end',
  },
  itemQty: {
    fontSize: 14,
    fontWeight: '700',
  },
  labelsSection: {
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelCarrier: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  labelTracking: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  templateRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  templateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  templateChipActive: {
    backgroundColor: colors.primary + '22',
    borderColor: colors.primary,
  },
  templateChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  templateChipTextActive: {
    color: colors.primary,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  submitBtn: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Done screen
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  doneTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  doneOrderNumber: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  doneBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 10,
    marginTop: spacing.md,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
})
}
