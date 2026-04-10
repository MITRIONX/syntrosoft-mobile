import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { Plus, Printer, Trash2 } from 'lucide-react-native'
import { api, Auftrag } from '../../lib/api'
import { colors, spacing } from '../../theme'
import { FulfillmentItem, CreatedLabel } from '../VersandWizard'
import { printWithContext } from '../../lib/printer'

interface Props {
  auftrag: Auftrag
  items: FulfillmentItem[]
  labels: CreatedLabel[]
  onLabelsChange: (labels: CreatedLabel[]) => void
  onNext: () => void
}

type Carrier = 'dhl' | 'dpd'
type DhlProduct = 'V01PAK' | 'V53WPAK' | 'V62WP'

interface Package {
  id: string
  weightKg: string
  loading: boolean
  labelId?: number
  trackingNumber?: string
  pdfBase64?: string
}

const DHL_PRODUCTS: { value: DhlProduct; label: string }[] = [
  { value: 'V01PAK', label: 'Paket' },
  { value: 'V53WPAK', label: 'Sperrgut' },
  { value: 'V62WP', label: 'Warenpost' },
]

let pkgCounter = 0
function newPkg(): Package {
  return { id: String(++pkgCounter), weightKg: '1', loading: false }
}

export function Step2Pakete({ auftrag, items, labels, onLabelsChange, onNext }: Props) {
  const [carrier, setCarrier] = useState<Carrier>('dhl')
  const [dhlProduct, setDhlProduct] = useState<DhlProduct>('V01PAK')
  const [packages, setPackages] = useState<Package[]>([newPkg()])

  const eigenItems = items.filter(i => i.fulfillType === 'eigen')

  function updatePkg(id: string, changes: Partial<Package>) {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p))
  }

  function addPkg() {
    setPackages(prev => [...prev, newPkg()])
  }

  function removePkg(id: string) {
    if (packages.length <= 1) return
    setPackages(prev => prev.filter(p => p.id !== id))
    onLabelsChange(labels.filter((_, i) => {
      const pkg = packages.find(p => p.id === id)
      return !pkg?.labelId || labels[i]?.id !== pkg.labelId
    }))
  }

  async function createLabel(pkgId: string) {
    const pkgIdx = packages.findIndex(p => p.id === pkgId)
    const pkg = packages[pkgIdx]
    if (!pkg) return

    updatePkg(pkgId, { loading: true })

    const detail = auftrag as any
    try {
      const res = await api.createShippingLabel({
        orderId: auftrag.id,
        recipientName: [
          detail.shipping_first_name || detail.billing_first_name,
          detail.shipping_last_name || detail.billing_last_name,
        ].filter(Boolean).join(' '),
        recipientCompany: detail.shipping_company || detail.billing_company || '',
        recipientStreet: detail.shipping_street || detail.billing_street || '',
        recipientPostalCode: detail.shipping_postal_code || detail.billing_postal_code || '',
        recipientCity: detail.shipping_city || detail.billing_city || '',
        recipientCountry: detail.shipping_country || detail.billing_country || 'DE',
        recipientEmail: detail.shipping_email || detail.billing_email || '',
        weightKg: parseFloat(pkg.weightKg) || 1,
        carrier,
        product: carrier === 'dhl' ? dhlProduct : undefined,
        packageNumber: pkgIdx + 1,
        totalPackages: packages.length,
      })

      if (!res.success || !res.label) {
        throw new Error(res.error || 'Label-Erstellung fehlgeschlagen')
      }

      const labelId: number = res.label.id
      const trackingNumber: string = res.label.tracking_number || res.label.trackingNumber || ''

      // fetch PDF
      let pdfBase64: string | undefined
      try {
        const pdfRes = await api.getLabelPdf(labelId)
        if (pdfRes.success) pdfBase64 = pdfRes.pdf
      } catch {
        // PDF optional — label still created
      }

      updatePkg(pkgId, { loading: false, labelId, trackingNumber, pdfBase64 })

      const newLabel: CreatedLabel = { id: labelId, trackingNumber, carrier, pdfBase64 }
      onLabelsChange([...labels.filter(l => l.id !== labelId), newLabel])
    } catch (e: any) {
      updatePkg(pkgId, { loading: false })
      Alert.alert('Fehler', e.message || 'Label konnte nicht erstellt werden')
    }
  }

  async function printLabel(pkg: Package) {
    if (!pkg.pdfBase64) {
      Alert.alert('Kein PDF', 'PDF fuer dieses Label nicht verfuegbar')
      return
    }
    const result = await printWithContext(`carrier:${carrier}`, pkg.pdfBase64)
    if (!result.success) {
      Alert.alert('Druckfehler', result.error || 'Drucken fehlgeschlagen')
    }
  }

  const labelCount = packages.filter(p => p.labelId !== undefined).length

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Summary */}
        {eigenItems.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Positionen (Eigenversand)</Text>
            {eigenItems.map(item => (
              <View key={item.id} style={styles.summaryRow}>
                <Text style={styles.summaryArtNr}>{item.article_number || '—'}</Text>
                <Text style={styles.summaryQty}>x{item.liefermenge}</Text>
                <Text style={styles.summaryName} numberOfLines={1}>{item.article_name || '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Carrier selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Versanddienstleister</Text>
          <View style={styles.segRow}>
            {(['dhl', 'dpd'] as Carrier[]).map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.segBtn, carrier === c && styles.segBtnActive]}
                onPress={() => setCarrier(c)}
              >
                <Text style={[styles.segBtnText, carrier === c && styles.segBtnTextActive]}>
                  {c.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* DHL product */}
          {carrier === 'dhl' && (
            <View style={[styles.segRow, { marginTop: spacing.sm }]}>
              {DHL_PRODUCTS.map(prod => (
                <TouchableOpacity
                  key={prod.value}
                  style={[styles.segBtn, dhlProduct === prod.value && styles.segBtnActive]}
                  onPress={() => setDhlProduct(prod.value)}
                >
                  <Text style={[styles.segBtnText, dhlProduct === prod.value && styles.segBtnTextActive]}>
                    {prod.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Packages */}
        {packages.map((pkg, idx) => (
          <View key={pkg.id} style={styles.card}>
            <View style={styles.pkgHeader}>
              <Text style={styles.pkgTitle}>Paket {idx + 1}</Text>
              {packages.length > 1 && (
                <TouchableOpacity onPress={() => removePkg(pkg.id)} style={styles.trashBtn}>
                  <Trash2 size={16} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>

            {/* Weight */}
            <View style={styles.weightRow}>
              <Text style={styles.weightLabel}>Gewicht (kg)</Text>
              <TextInput
                style={styles.weightInput}
                value={pkg.weightKg}
                onChangeText={v => updatePkg(pkg.id, { weightKg: v })}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                editable={!pkg.loading && !pkg.labelId}
              />
            </View>

            {/* Create label or result */}
            {pkg.labelId === undefined ? (
              <TouchableOpacity
                style={[styles.createBtn, pkg.loading && styles.createBtnDisabled]}
                onPress={() => createLabel(pkg.id)}
                disabled={pkg.loading}
              >
                {pkg.loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createBtnText}>Label erstellen</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.labelResult}>
                <View style={styles.trackingRow}>
                  <Text style={styles.trackingLabel}>Tracking:</Text>
                  <Text style={styles.trackingNumber}>{pkg.trackingNumber || '—'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.printBtn}
                  onPress={() => printLabel(pkg)}
                >
                  <Printer size={14} color="#fff" />
                  <Text style={styles.printBtnText}>Drucken</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {/* Add package */}
        <TouchableOpacity style={styles.addPkgBtn} onPress={addPkg}>
          <Plus size={16} color={colors.primary} />
          <Text style={styles.addPkgText}>Paket hinzufuegen</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerCount}>
          {labelCount} {labelCount === 1 ? 'Label' : 'Labels'} erstellt
        </Text>
        <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryArtNr: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    minWidth: 70,
  },
  summaryQty: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 28,
  },
  summaryName: {
    color: colors.text,
    fontSize: 13,
    flex: 1,
  },
  segRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  segBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  segBtnTextActive: {
    color: '#fff',
  },
  pkgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pkgTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  trashBtn: {
    padding: 4,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weightLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  weightInput: {
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    color: colors.text,
    fontSize: 14,
    minWidth: 80,
    textAlign: 'right',
  },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  labelResult: {
    gap: spacing.xs,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trackingLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  trackingNumber: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
    flex: 1,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  printBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  addPkgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addPkgText: {
    color: colors.primary,
    fontSize: 14,
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
  nextBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
})
