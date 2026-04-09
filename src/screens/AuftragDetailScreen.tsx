import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, User, MapPin, Package, Euro, Truck, CreditCard, Hash, FileText } from 'lucide-react-native'
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
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
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

function AddressCard({
  title,
  icon,
  name,
  street,
  postalCode,
  city,
  country,
  expanded,
  onToggle,
}: {
  title: string
  icon: any
  name: string
  street?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  expanded: boolean
  onToggle: () => void
}) {
  const Icon = icon
  const shortAddress = [city].filter(Boolean).join(', ')
  const fullAddress = [street, [postalCode, city].filter(Boolean).join(' '), country].filter(Boolean)

  return (
    <TouchableOpacity style={[styles.card, expanded && styles.cardExpanded]} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Icon size={16} color={colors.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.addressName} numberOfLines={expanded ? undefined : 1}>{name}</Text>
      {expanded ? (
        fullAddress.map((line, i) => (
          <Text key={i} style={styles.addressLine}>{line}</Text>
        ))
      ) : (
        shortAddress ? <Text style={styles.addressShort} numberOfLines={1}>{shortAddress}</Text> : null
      )}
    </TouchableOpacity>
  )
}

export function AuftragDetailScreen({ auftrag, onBack }: AuftragDetailScreenProps) {
  const insets = useSafeAreaInsets()
  const [expandedAddress, setExpandedAddress] = useState<'billing' | 'shipping' | null>(null)

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

  const hasShipping = detail?.shipping_street && detail.shipping_street !== detail.billing_street

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

          {/* Externe Auftragsnummer */}
          {detail.external_order_number && (
            <View style={styles.externalRow}>
              <FileText size={14} color={colors.textMuted} />
              <Text style={styles.externalLabel}>Ext. Nr.:</Text>
              <Text style={styles.externalValue}>{detail.external_order_number}</Text>
            </View>
          )}

          {/* Kunde-Info Zeile */}
          <View style={styles.kundeInfoRow}>
            {detail.customer_number && (
              <View style={styles.kundeInfoItem}>
                <Text style={styles.kundeInfoLabel}>Kd.-Nr.</Text>
                <Text style={styles.kundeInfoValue}>{detail.customer_number}</Text>
              </View>
            )}
            {detail.customer_group_name && (
              <View style={styles.kundeInfoItem}>
                <Text style={styles.kundeInfoLabel}>Kundengruppe</Text>
                <Text style={styles.kundeInfoValue}>{detail.customer_group_name}</Text>
              </View>
            )}
            {detail.payment_method && (
              <View style={styles.kundeInfoItem}>
                <Text style={styles.kundeInfoLabel}>Zahlungsart</Text>
                <Text style={styles.kundeInfoValue}>{detail.payment_method}</Text>
              </View>
            )}
          </View>

          {/* Adressen - 2er Grid, klickbar */}
          <View style={expandedAddress ? undefined : styles.addressGrid}>
            {(!expandedAddress || expandedAddress === 'billing') && (
              <AddressCard
                title="Rechnung"
                icon={User}
                name={billingName}
                street={detail.billing_street}
                postalCode={detail.billing_postal_code}
                city={detail.billing_city}
                country={detail.billing_country}
                expanded={expandedAddress === 'billing'}
                onToggle={() => setExpandedAddress(expandedAddress === 'billing' ? null : 'billing')}
              />
            )}
            {hasShipping && (!expandedAddress || expandedAddress === 'shipping') && (
              <AddressCard
                title="Lieferung"
                icon={Truck}
                name={shippingName || billingName}
                street={detail.shipping_street}
                postalCode={detail.shipping_postal_code}
                city={detail.shipping_city}
                country={detail.shipping_country}
                expanded={expandedAddress === 'shipping'}
                onToggle={() => setExpandedAddress(expandedAddress === 'shipping' ? null : 'shipping')}
              />
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
    marginBottom: spacing.sm,
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
  externalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  externalLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  externalValue: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  kundeInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  kundeInfoItem: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kundeInfoLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  kundeInfoValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
    marginTop: 1,
  },
  addressGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
  },
  cardExpanded: {
    marginBottom: spacing.sm,
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
  addressName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  addressShort: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  addressLine: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
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
