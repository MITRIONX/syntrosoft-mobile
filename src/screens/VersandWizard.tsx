import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, X } from 'lucide-react-native'
import { api, Auftrag, AuftragDetail, OrderItem } from '../lib/api'
import { colors, spacing } from '../theme'
import { Step1Positionen } from './wizard/Step1Positionen'
import { Step2Pakete } from './wizard/Step2Pakete'
import { Step3Abschluss } from './wizard/Step3Abschluss'

export interface FulfillmentItem extends OrderItem {
  fulfillType: 'eigen' | 'strecke' | 'ekliste' | 'produktion' | 'skip'
  liefermenge: number
  supplierId?: number | null
  supplierName?: string | null
}

export interface CreatedLabel {
  id: number
  trackingNumber: string
  carrier: string
  pdfBase64?: string
}

type WizardStep = 'positionen' | 'pakete' | 'abschluss'

const STEP_LABELS: Record<WizardStep, string> = {
  positionen: 'Positionen',
  pakete: 'Pakete',
  abschluss: 'Abschluss',
}

interface Props {
  auftrag: Auftrag
  onClose: () => void
  onComplete: () => void
}

export function VersandWizard({ auftrag, onClose, onComplete }: Props) {
  const [step, setStep] = useState<WizardStep>('positionen')
  const [items, setItems] = useState<FulfillmentItem[]>([])
  const [labels, setLabels] = useState<CreatedLabel[]>([])
  const [auftragDetail, setAuftragDetail] = useState<AuftragDetail | null>(null)

  useEffect(() => {
    api.getAuftrag(auftrag.id)
      .then(res => { if (res.success) setAuftragDetail(res.data) })
      .catch(() => {})
  }, [auftrag.id])

  const hasEigenItems = items.some(i => i.fulfillType === 'eigen')

  const steps: WizardStep[] = [
    'positionen',
    ...(hasEigenItems ? ['pakete' as WizardStep] : []),
    'abschluss',
  ]

  const currentIndex = steps.indexOf(step)

  function goNext() {
    const next = steps[currentIndex + 1]
    if (next) setStep(next)
  }

  function goBack() {
    if (currentIndex === 0) {
      onClose()
    } else {
      setStep(steps[currentIndex - 1])
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Auftrag {auftrag.order_number}</Text>
          <Text style={styles.headerStep}>{STEP_LABELS[step]}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.dots}>
            {steps.map((s, i) => (
              <View
                key={s}
                style={[
                  styles.dot,
                  i === currentIndex && styles.dotActive,
                  i < currentIndex && styles.dotDone,
                ]}
              />
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Steps */}
      {step === 'positionen' && (
        <Step1Positionen
          auftrag={auftrag}
          items={items}
          onItemsLoaded={setItems}
          onNext={() => {
            // Recompute steps after items known, then navigate
            goNext()
          }}
        />
      )}
      {step === 'pakete' && (
        <Step2Pakete
          auftrag={auftragDetail || auftrag}
          items={items}
          labels={labels}
          onLabelsChange={setLabels}
          onNext={goNext}
        />
      )}
      {step === 'abschluss' && (
        <Step3Abschluss
          auftrag={auftrag}
          items={items}
          labels={labels}
          onComplete={onComplete}
        />
      )}
    </SafeAreaView>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  headerStep: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  closeButton: {
    padding: 4,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },
  dotDone: {
    backgroundColor: colors.success,
  },
})
