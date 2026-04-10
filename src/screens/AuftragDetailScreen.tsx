import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, User, MapPin, Package, Euro, Truck, CreditCard, Hash, FileText, FileCheck } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { api, Auftrag, AuftragDetail, AuftragItem, AuftragRelated, PurchaseOrder } from '../lib/api'
import { BestellungDetailScreen } from './BestellungDetailScreen'
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

const STATUS_COLORS: Record<string, string> = {
  offen: '#3b82f6',
  in_bearbeitung: '#f59e0b',
  versendet: '#a855f7',
  abgeschlossen: '#22c55e',
  storniert: '#ef4444',
}

function StatusBadge({ status }: { status: string }) {
  const styles = createStyles()
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
  const styles = createStyles()
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

const TRACKING_URLS: Record<string, string> = {
  DHL: 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=',
  DPD: 'https://tracking.dpd.de/status/de_DE/parcel/',
  UPS: 'https://www.ups.com/track?tracknum=',
  GLS: 'https://gls-group.com/DE/de/paketverfolgung?match=',
  HERMES: 'https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation?trackingId=',
}

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  delivered: '#22c55e',
  in_transit: '#3b82f6',
  unknown: '#6b7280',
}

function FulfillmentSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const fulfillStyles = createFulfillStyles()
  return (
    <View style={fulfillStyles.section}>
      <View style={fulfillStyles.sectionHeader}>
        {icon}
        <Text style={fulfillStyles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

/** Dynamischer Bestell-Status */
function computeStatus(detail: AuftragDetail, related: AuftragRelated | undefined): { label: string; color: string } {
  if (detail.is_cancelled) return { label: 'Storniert', color: '#ef4444' }
  const cs = (detail as any).computed_status
  if (cs) {
    const map: Record<string, { label: string; color: string }> = {
      bestellt: { label: 'Bestellt', color: '#22c55e' },
      teilbestellt: { label: 'Teilbestellt', color: '#f59e0b' },
      storniert: { label: 'Storniert', color: '#ef4444' },
    }
    if (map[cs]) return map[cs]
  }
  // Fallback: aus Related-Daten berechnen
  const po = related?.purchaseOrders || []
  const shopping = related?.shoppingListItems || []
  if (po.length > 0) return { label: 'Bestellt', color: '#22c55e' }
  if (shopping.length > 0) return { label: 'Auf EK-Liste', color: '#f59e0b' }
  return { label: 'Offen', color: '#3b82f6' }
}

function FulfillmentCard({ related, onSelectPO }: { related: AuftragRelated | undefined; onSelectPO: (po: any) => void }) {
  const styles = createStyles()
  const fulfillStyles = createFulfillStyles()
  const po = related?.purchaseOrders || []
  const allLabels = related?.shippingLabels || []
  const tracking = related?.trackingData || []
  // Labels rausfiltern die schon als Tracking-Eintrag existieren (Tracking hat mehr Infos)
  const trackingNumbers = new Set(tracking.map((t: any) => t.trackingnummer))
  const labels = allLabels.filter((l: any) => !trackingNumbers.has(l.tracking_number))
  const belege = related?.eingangsbelege || []
  const allAbLogs = (related as any)?.abLogs || []
  // Rechnungen aus AB-Logs herausfiltern und zu Eingangsrechnungen verschieben
  const isRechnung = (ab: any) => /rechnung|invoice|VRE/i.test(ab.attachment_filename || '')
  const abLogs = allAbLogs.filter((ab: any) => !isRechnung(ab))
  const rechnungenFromAb = allAbLogs.filter(isRechnung)
  const hasAny = related && (po.length > 0 || labels.length > 0 || tracking.length > 0 || belege.length > 0 || allAbLogs.length > 0)

  const openTracking = (carrier: string, trackingNumber: string, customUrl?: string) => {
    if (customUrl) {
      Linking.openURL(customUrl)
      return
    }
    const base = TRACKING_URLS[carrier?.toUpperCase()] || null
    if (base) {
      Linking.openURL(base + encodeURIComponent(trackingNumber))
    }
  }

  return (
    <View style={[styles.card, fulfillStyles.card]}>
      <View style={styles.cardHeader}>
        <Truck size={18} color={colors.primary} />
        <Text style={styles.cardTitle}>Fulfillment</Text>
      </View>

      {!related ? (
        <ActivityIndicator size="small" color={colors.textMuted} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
      ) : !hasAny ? (
        <Text style={fulfillStyles.emptyText}>Keine Fulfillment-Daten vorhanden</Text>
      ) : (
        <>
          {/* 1. Bestellungen */}
          {po.length > 0 && (
            <FulfillmentSection title="Lieferantenbestellungen" icon={<Package size={13} color={colors.textMuted} />}>
              {po.map((p: any, i: number) => (
                <TouchableOpacity key={p.id || i} style={[fulfillStyles.row, i > 0 && fulfillStyles.rowBorder]} onPress={() => onSelectPO(p)} activeOpacity={0.7}>
                  <View style={fulfillStyles.rowMain}>
                    <Text style={[fulfillStyles.rowTitle, fulfillStyles.trackingLink]}>{p.order_number}</Text>
                    <Text style={fulfillStyles.rowSub} numberOfLines={1}>{p.supplier_name}</Text>
                  </View>
                  <View style={fulfillStyles.rowRight}>
                    <View style={[fulfillStyles.minibadge, { backgroundColor: '#6b728025' }]}>
                      <Text style={[fulfillStyles.minibadgeText, { color: '#6b7280' }]}>
                        {String(p.status_text || p.status || '')}
                      </Text>
                    </View>
                    <Text style={fulfillStyles.rowDate}>{formatDate(p.order_date)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </FulfillmentSection>
          )}

          {/* 2. Auftragsbestaetigungen */}
          {abLogs.length > 0 && (
            <FulfillmentSection title="Auftragsbestaetigungen" icon={<FileCheck size={13} color={colors.textMuted} />}>
              {abLogs.map((ab: any, i: number) => (
                <TouchableOpacity
                  key={ab.id || i}
                  style={[fulfillStyles.row, i > 0 && fulfillStyles.rowBorder]}
                  onPress={() => ab.attachment_id > 0 && api.openAbAttachment(ab.attachment_id)}
                  activeOpacity={ab.attachment_id > 0 ? 0.7 : 1}
                >
                  <View style={fulfillStyles.rowMain}>
                    <Text style={[fulfillStyles.rowTitle, ab.attachment_id > 0 && fulfillStyles.trackingLink]}>
                      {String(ab.attachment_filename || ab.matched_order_number || '-')}
                    </Text>
                    <Text style={fulfillStyles.rowSub}>{ab.supplier_name}</Text>
                  </View>
                  <View style={fulfillStyles.rowRight}>
                    <View style={[fulfillStyles.minibadge, { backgroundColor: ab.status === 'verified' ? '#22c55e25' : '#3b82f625' }]}>
                      <Text style={[fulfillStyles.minibadgeText, { color: ab.status === 'verified' ? '#22c55e' : '#3b82f6' }]}>
                        {ab.status === 'verified' ? 'Verifiziert' : 'Erkannt'}
                      </Text>
                    </View>
                    <Text style={fulfillStyles.rowDate}>{formatDate(ab.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </FulfillmentSection>
          )}

          {/* 3. Eingangsrechnungen (echte Belege + Rechnungen aus AB-Logs) */}
          {(belege.length > 0 || rechnungenFromAb.length > 0) && (
            <FulfillmentSection title="Eingangsrechnungen" icon={<FileCheck size={13} color={colors.textMuted} />}>
              {rechnungenFromAb.map((ab: any, i: number) => (
                <TouchableOpacity
                  key={'rab-' + (ab.id || i)}
                  style={[fulfillStyles.row, i > 0 && fulfillStyles.rowBorder]}
                  onPress={() => ab.attachment_id > 0 && api.openAbAttachment(ab.attachment_id)}
                  activeOpacity={ab.attachment_id > 0 ? 0.7 : 1}
                >
                  <View style={fulfillStyles.rowMain}>
                    <Text style={[fulfillStyles.rowTitle, ab.attachment_id > 0 && fulfillStyles.trackingLink]}>
                      {String(ab.attachment_filename || '-')}
                    </Text>
                    <Text style={fulfillStyles.rowSub}>{ab.supplier_name}</Text>
                  </View>
                  <View style={fulfillStyles.rowRight}>
                    <View style={[fulfillStyles.minibadge, { backgroundColor: '#22c55e25' }]}>
                      <Text style={[fulfillStyles.minibadgeText, { color: '#22c55e' }]}>Rechnung</Text>
                    </View>
                    <Text style={fulfillStyles.rowDate}>{formatDate(ab.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {belege.map((beleg: any, i: number) => (
                <TouchableOpacity
                  key={'bel-' + (beleg.id || i)}
                  style={[fulfillStyles.row, (i > 0 || rechnungenFromAb.length > 0) && fulfillStyles.rowBorder]}
                  onPress={() => beleg.has_pdf && api.openEingangsbelegPdf(beleg.id)}
                  activeOpacity={beleg.has_pdf ? 0.7 : 1}
                >
                  <View style={fulfillStyles.rowMain}>
                    <Text style={[fulfillStyles.rowTitle, beleg.has_pdf && fulfillStyles.trackingLink]}>
                      {String(beleg.beleg_nummer || beleg.commission_number || '-')}
                      {beleg.has_pdf ? ' 📄' : ''}
                    </Text>
                    <Text style={fulfillStyles.rowSub}>{formatDate(beleg.beleg_datum || beleg.created_at)}</Text>
                  </View>
                  <Text style={fulfillStyles.rowAmount}>{formatCurrency(Number(beleg.netto_betrag) || 0)}</Text>
                </TouchableOpacity>
              ))}
            </FulfillmentSection>
          )}

          {/* 4. Versand & Tracking */}
          {(labels.length > 0 || tracking.length > 0) && (
            <FulfillmentSection title="Versand & Tracking" icon={<Truck size={13} color={colors.textMuted} />}>
              {labels.map((label: any, i: number) => (
                <TouchableOpacity
                  key={'label-' + (label.id || i)}
                  style={[fulfillStyles.row, i > 0 && fulfillStyles.rowBorder]}
                  onPress={() => openTracking(label.carrier, label.tracking_number)}
                  activeOpacity={0.7}
                >
                  <View style={fulfillStyles.rowMain}>
                    <Text style={fulfillStyles.rowTitle}>{label.carrier}</Text>
                    <Text style={[fulfillStyles.rowSub, fulfillStyles.trackingLink]} numberOfLines={1}>
                      {label.tracking_number}
                    </Text>
                  </View>
                  <View style={[fulfillStyles.minibadge, { backgroundColor: '#3b82f625' }]}>
                    <Text style={[fulfillStyles.minibadgeText, { color: '#3b82f6' }]}>
                      {String(label.status || '')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {tracking.map((t: any, i: number) => {
                const statusLabel = t.status_label || (
                  t.delivery_status === 'delivered' ? 'Zugestellt' :
                  t.delivery_status === 'in_transit' ? 'Unterwegs' :
                  t.delivery_status === 'pending' ? 'Ausstehend' :
                  String(t.delivery_status || 'Unbekannt')
                )
                const statusColor =
                  t.delivery_status === 'delivered' ? '#22c55e' :
                  t.delivery_status === 'in_transit' ? '#3b82f6' :
                  t.delivery_status === 'pending' ? '#f59e0b' :
                  '#6b7280'
                const trackingUrl = t.carrier_tracking_url || t.raw_data?.Url || null
                return (
                  <TouchableOpacity
                    key={'track-' + (t.id || i)}
                    style={[fulfillStyles.row, (i > 0 || labels.length > 0) && fulfillStyles.rowBorder]}
                    onPress={() => openTracking(t.dienstleister, t.trackingnummer, trackingUrl)}
                    activeOpacity={0.7}
                  >
                    <View style={fulfillStyles.rowMain}>
                      <Text style={[fulfillStyles.rowTitle, fulfillStyles.trackingLink]}>{t.trackingnummer}</Text>
                      <Text style={fulfillStyles.rowSub}>{t.dienstleister} {t.lieferant ? `(${t.lieferant})` : ''}</Text>
                    </View>
                    <View style={fulfillStyles.rowRight}>
                      <View style={[fulfillStyles.minibadge, { backgroundColor: statusColor + '25' }]}>
                        <Text style={[fulfillStyles.minibadgeText, { color: statusColor }]}>
                          {statusLabel}
                        </Text>
                      </View>
                      <Text style={fulfillStyles.rowDate}>{formatDate(t.delivered_at || t.created_at)}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </FulfillmentSection>
          )}
        </>
      )}
    </View>
  )
}

export function AuftragDetailScreen({ auftrag, onBack }: AuftragDetailScreenProps) {
  const styles = createStyles()
  const insets = useSafeAreaInsets()
  const [expandedAddress, setExpandedAddress] = useState<'billing' | 'shipping' | null>(null)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['auftrag', auftrag.id],
    queryFn: () => api.getAuftrag(auftrag.id),
  })

  const { data: relatedData } = useQuery({
    queryKey: ['auftrag-related', auftrag.id],
    queryFn: () => api.getAuftragRelated(auftrag.id),
    enabled: !!data?.data,
  })

  const { data: fulfillData } = useQuery({
    queryKey: ['auftrag-fulfill-items', auftrag.id],
    queryFn: () => api.getOrderItemsForFulfillment(auftrag.id),
    enabled: !!data?.data,
  })

  const related: AuftragRelated | undefined = relatedData?.data
  const fulfillItemsMap = new Map<string, any>()
  if (fulfillData?.items) {
    for (const fi of fulfillData.items) {
      if (fi.article_number) fulfillItemsMap.set(fi.article_number, fi)
    }
  }

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

  if (selectedPO) {
    return <BestellungDetailScreen order={selectedPO} onBack={() => setSelectedPO(null)} />
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle} numberOfLines={1}>#{auftrag.order_number}</Text>
          {auftrag.external_order_number && (
            <Text style={styles.headerExtNr} numberOfLines={1}>{auftrag.external_order_number}</Text>
          )}
        </View>
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

          {/* Dynamischer Status */}
          {(() => {
            const s = computeStatus(detail, related)
            return (
              <View style={styles.statusRow}>
                <View style={[styles.badge, { backgroundColor: s.color + '20', borderColor: s.color + '40' }]}>
                  <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
                </View>
                <Text style={styles.dateText}>{formatDate((detail as any).created_at || detail.order_date)}</Text>
              </View>
            )
          })()}

          {/* Kd.-Nr. | Zahlungsart als Cards */}
          <View style={styles.infoCards}>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardLabel}>Kd.-Nr.</Text>
              <Text style={styles.infoCardValue}>{detail.customer_number || '-'}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardLabel}>Zahlungsart</Text>
              <Text style={styles.infoCardValue} numberOfLines={1}>{detail.payment_method || '-'}</Text>
            </View>
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
              <Text style={styles.cardHeaderDate}>{formatDate((detail as any).created_at || detail.order_date)}</Text>
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
            {detail.items.map((item: AuftragItem, index: number) => {
              const fi = item.article_number ? fulfillItemsMap.get(item.article_number) : null
              const badges: { label: string; color: string }[] = []
              if (fi) {
                const eigenQty = Number(fi.fulfilled_eigenversand || 0)
                const noShipQty = Number(fi.fulfilled_no_shipping || 0)
                const streckeQty = Number(fi.fulfilled_strecke || 0) + Number(fi.fulfilled_dropshipping_of || 0)
                const ekQty = Number(fi.auf_einkaufsliste || 0)
                const ekBestellt = Number(fi.fulfilled_einkauf || 0)
                if (noShipQty > 0) badges.push({ label: `O. Versand ${Math.round(noShipQty)}`, color: '#6b7280' })
                if (eigenQty > 0) badges.push({ label: `Versendet ${Math.round(eigenQty)}`, color: '#a855f7' })
                if (streckeQty > 0) badges.push({ label: `Strecke ${Math.round(streckeQty)}`, color: '#8b5cf6' })
                if (ekBestellt > 0) badges.push({ label: `Bestellt ${Math.round(ekBestellt)}`, color: '#f59e0b' })
                if (ekQty > 0) badges.push({ label: `EK-Liste ${Math.round(ekQty)}`, color: '#f97316' })
              }
              return (
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
                    {badges.length > 0 && (
                      <View style={styles.positionBadges}>
                        {badges.map((b, i) => (
                          <View key={i} style={[styles.positionBadge, { backgroundColor: b.color + '20' }]}>
                            <Text style={[styles.positionBadgeText, { color: b.color }]}>{b.label}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <Text style={styles.positionTotal}>{formatCurrency(item.total_gross)}</Text>
                </View>
              )
            })}
          </View>

          {/* Fulfillment */}
          <FulfillmentCard related={related} onSelectPO={(po) => setSelectedPO({
            id: po.id,
            order_number: po.order_number,
            supplier_name: po.supplier_name,
            order_date: po.order_date,
            status_text: po.status_text || po.status,
            total_net: Number(po.total_net) || 0,
            total_gross: Number(po.total_gross) || 0,
            items_count: Number(po.items_count) || 0,
            qty_total: Number(po.qty_total) || 0,
            qty_delivered: Number(po.qty_delivered) || 0,
            reference_order_number: po.reference_order_number,
            is_dropshipping: po.is_dropshipping || 0,
            warehouse_name: po.warehouse_name,
            created_at: po.created_at,
          })} />

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

function createStyles() { return StyleSheet.create({
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
  headerTitles: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerExtNr: {
    fontSize: 13,
    color: colors.textMuted,
    marginLeft: 8,
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
  dateText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoCards: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoCardLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoCardValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    marginTop: 2,
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
  cardHeaderDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 'auto',
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
  positionBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 5,
  },
  positionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  positionBadgeText: {
    fontSize: 10,
    fontWeight: '600',
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
}) }

function createFulfillStyles() { return StyleSheet.create({
  card: {
    flex: 0,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: 4,
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 8,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  rowSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  trackingLink: {
    color: colors.primary,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  rowDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  rowAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  minibadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  minibage: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  minibadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
}) }
