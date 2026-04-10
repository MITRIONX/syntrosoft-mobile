import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Modal, ScrollView, RefreshControl, Linking, Alert,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, MapPin, CheckCircle, AlertTriangle, XCircle, Clock, Map } from 'lucide-react-native'
import { api, AddressValidation } from '../lib/api'
import { colors, spacing } from '../theme'

type FilterTab = 'alle' | 'fehlerhaft' | 'geprueft' | 'offen'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'fehlerhaft', label: 'Fehlerhaft' },
  { key: 'geprueft', label: 'Geprüft' },
  { key: 'offen', label: 'Offen' },
]

function statusColor(status: AddressValidation['validationStatus']): string {
  switch (status) {
    case 'VALID': return '#22c55e'
    case 'SUSPECT': return '#f59e0b'
    case 'INVALID': return '#ef4444'
    case 'PENDING': return '#6b7280'
  }
}

function statusLabel(status: AddressValidation['validationStatus']): string {
  switch (status) {
    case 'VALID': return 'OK'
    case 'SUSPECT': return 'Vorschlag'
    case 'INVALID': return 'Ungültig'
    case 'PENDING': return 'Offen'
  }
}

function StatusBadge({ status }: { status: AddressValidation['validationStatus'] }) {
  const styles = createStyles()
  const sc = statusColor(status)
  const label = statusLabel(status)
  return (
    <View style={[styles.badge, { backgroundColor: sc + '25' }]}>
      <Text style={[styles.badgeText, { color: sc }]}>{label}</Text>
    </View>
  )
}

function filterEntries(entries: AddressValidation[], tab: FilterTab, search: string): AddressValidation[] {
  let filtered = entries
  if (tab === 'fehlerhaft') filtered = filtered.filter(e => e.validationStatus === 'SUSPECT' || e.validationStatus === 'INVALID')
  else if (tab === 'geprueft') filtered = filtered.filter(e => e.validationStatus === 'VALID')
  else if (tab === 'offen') filtered = filtered.filter(e => e.validationStatus === 'PENDING')

  if (search.trim()) {
    const q = search.trim().toLowerCase()
    filtered = filtered.filter(e =>
      e.orderNumber.toLowerCase().includes(q) ||
      e.customerName.toLowerCase().includes(q)
    )
  }
  return filtered
}

interface KorrekturModalProps {
  item: AddressValidation
  onClose: () => void
  onUpdated: () => void
  autoGoogle?: boolean
}

function KorrekturModal({ item, onClose, onUpdated, autoGoogle }: KorrekturModalProps) {
  const styles = createStyles()
  const [company, setCompany] = useState((item as any).shippingCompany || '')
  const [firstName, setFirstName] = useState((item as any).shippingFirstName || '')
  const [lastName, setLastName] = useState((item as any).shippingLastName || '')
  const [street, setStreet] = useState(item.suggestion?.street ?? item.shippingStreet)
  const [addressLine2, setAddressLine2] = useState((item as any).shippingAddressLine2 || '')
  const [postalCode, setPostalCode] = useState(item.suggestion?.postalCode ?? item.shippingPostalCode)
  const [city, setCity] = useState(item.suggestion?.city ?? item.shippingCity)
  const [googleResult, setGoogleResult] = useState<{ formattedAddress?: string; structured?: { street: string; postalCode: string; city: string } } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [markingValid, setMarkingValid] = useState(false)

  useEffect(() => {
    if (autoGoogle) handleGoogleCheck()
  }, [])

  const handleGoogleCheck = async () => {
    setLoading(true)
    setGoogleResult(null)
    try {
      const res = await api.validateAddressGoogle({ street, postalCode, city, country: item.shippingCountry })
      setGoogleResult(res)
      if (res.structured) {
        setStreet(res.structured.street)
        setPostalCode(res.structured.postalCode)
        setCity(res.structured.city)
      }
    } catch (e) {
      Alert.alert('Fehler', String((e as Error)?.message || 'Google-Prüfung fehlgeschlagen'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenMaps = () => {
    const query = encodeURIComponent(`${street}, ${postalCode} ${city}`)
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`)
  }

  const handleMarkValid = async () => {
    setMarkingValid(true)
    try {
      await api.markAddressValid(item.orderId)
      onUpdated()
      onClose()
    } catch (e) {
      Alert.alert('Fehler', String((e as Error)?.message || 'Konnte nicht als gültig markieren'))
    } finally {
      setMarkingValid(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateOrderAddress(item.orderId, {
        shipping_company: company,
        shipping_first_name: firstName,
        shipping_last_name: lastName,
        shipping_street: street,
        shipping_address_line2: addressLine2,
        shipping_postal_code: postalCode,
        shipping_city: city,
      } as any)
      // re-validate
      await api.validateOrderAddresses([item.orderId])
      onUpdated()
      onClose()
    } catch (e) {
      Alert.alert('Fehler', String((e as Error)?.message || 'Speichern fehlgeschlagen'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Adresse korrigieren</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} activeOpacity={0.7}>
              <Text style={styles.modalCloseBtnText}>Schliessen</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Original */}
            <View style={[styles.modalSection, styles.sectionOriginal]}>
              <Text style={styles.modalSectionTitle}>Original</Text>
              <Text style={styles.modalSectionText}>{item.shippingStreet}</Text>
              <Text style={styles.modalSectionText}>{item.shippingPostalCode} {item.shippingCity}</Text>
              <Text style={styles.modalSectionText}>{item.shippingCountry}</Text>
            </View>

            {/* DHL Vorschlag */}
            {item.suggestion && (
              <View style={[styles.modalSection, styles.sectionSuggestion]}>
                <Text style={styles.modalSectionTitle}>DHL Vorschlag</Text>
                <Text style={styles.modalSectionText}>{item.suggestion.street}</Text>
                <Text style={styles.modalSectionText}>{item.suggestion.postalCode} {item.suggestion.city}</Text>
              </View>
            )}

            {/* Google Ergebnis */}
            {googleResult?.formattedAddress && (
              <View style={[styles.modalSection, styles.sectionGoogle]}>
                <Text style={styles.modalSectionTitle}>Google Ergebnis</Text>
                <Text style={styles.modalSectionText}>{googleResult.formattedAddress}</Text>
              </View>
            )}

            {/* Korrektur */}
            <View style={[styles.modalSection, styles.sectionCorrection]}>
              <Text style={styles.modalSectionTitle}>Korrektur</Text>
              <Text style={styles.inputLabel}>Firma</Text>
              <TextInput
                style={styles.textInput}
                value={company}
                onChangeText={setCompany}
                placeholderTextColor={colors.textMuted}
                placeholder="Firma"
                autoCapitalize="words"
              />
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Vorname</Text>
                  <TextInput
                    style={styles.textInput}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholderTextColor={colors.textMuted}
                    placeholder="Vorname"
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Nachname</Text>
                  <TextInput
                    style={styles.textInput}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholderTextColor={colors.textMuted}
                    placeholder="Nachname"
                    autoCapitalize="words"
                  />
                </View>
              </View>
              <Text style={styles.inputLabel}>Strasse</Text>
              <TextInput
                style={styles.textInput}
                value={street}
                onChangeText={setStreet}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
              <Text style={styles.inputLabel}>Adresszusatz</Text>
              <TextInput
                style={styles.textInput}
                value={addressLine2}
                onChangeText={setAddressLine2}
                placeholderTextColor={colors.textMuted}
                placeholder="z.B. Hinterhaus, 2. OG"
                autoCapitalize="words"
              />
              <Text style={styles.inputLabel}>PLZ</Text>
              <TextInput
                style={styles.textInput}
                value={postalCode}
                onChangeText={setPostalCode}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
              <Text style={styles.inputLabel}>Ort</Text>
              <TextInput
                style={styles.textInput}
                value={city}
                onChangeText={setCity}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={handleGoogleCheck}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={[styles.actionBtnText, { color: colors.primary }]}>Google prüfen</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={handleOpenMaps}
                activeOpacity={0.7}
              >
                <Map size={14} color={colors.textSecondary} />
                <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>In Maps öffnen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnWarning]}
                onPress={handleMarkValid}
                disabled={markingValid}
                activeOpacity={0.7}
              >
                {markingValid
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[styles.actionBtnText, { color: '#fff' }]}>Als gültig markieren</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSuccess]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.7}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[styles.actionBtnText, { color: '#fff' }]}>Korrektur übernehmen</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

export function AdressvalidierungScreen() {
  const styles = createStyles()
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('alle')
  const [search, setSearch] = useState('')
  const [korrekturItem, setKorrekturItem] = useState<AddressValidation | null>(null)
  const [autoGoogleCheck, setAutoGoogleCheck] = useState(false)
  const [validatingAll, setValidatingAll] = useState(false)
  const [validatingSingle, setValidatingSingle] = useState<number | null>(null)

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['adressvalidierung'],
    queryFn: () => api.validateOrderAddresses(),
  })

  const entries = data?.data || []
  const filtered = filterEntries(entries, activeFilter, search)

  const stats = {
    ok: entries.filter(e => e.validationStatus === 'VALID').length,
    vorschlag: entries.filter(e => e.validationStatus === 'SUSPECT').length,
    ungueltig: entries.filter(e => e.validationStatus === 'INVALID').length,
    offen: entries.filter(e => e.validationStatus === 'PENDING').length,
  }

  const handleValidateAll = async () => {
    const pending = entries.filter(e => e.validationStatus === 'PENDING').map(e => e.orderId)
    if (pending.length === 0) {
      Alert.alert('Info', 'Keine offenen Adressen zu prüfen.')
      return
    }
    setValidatingAll(true)
    try {
      await api.validateOrderAddresses(pending)
      queryClient.invalidateQueries({ queryKey: ['adressvalidierung'] })
    } catch (e) {
      Alert.alert('Fehler', String((e as Error)?.message || 'Validierung fehlgeschlagen'))
    } finally {
      setValidatingAll(false)
    }
  }

  const handleValidateSingle = async (item: AddressValidation) => {
    setValidatingSingle(item.orderId)
    try {
      await api.validateOrderAddresses([item.orderId])
      queryClient.invalidateQueries({ queryKey: ['adressvalidierung'] })
    } catch (e) {
      Alert.alert('Fehler', String((e as Error)?.message || 'Validierung fehlgeschlagen'))
    } finally {
      setValidatingSingle(null)
    }
  }

  const handleMarkValid = async (item: AddressValidation) => {
    try {
      await api.markAddressValid(item.orderId)
      queryClient.invalidateQueries({ queryKey: ['adressvalidierung'] })
    } catch (e) {
      Alert.alert('Fehler', String((e as Error)?.message || 'Fehler beim Markieren'))
    }
  }

  const renderItem = ({ item }: { item: AddressValidation }) => {
    const showActions = item.validationStatus === 'SUSPECT' || item.validationStatus === 'INVALID' || item.validationStatus === 'PENDING'
    const isSingleValidating = validatingSingle === item.orderId

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            {item.validatedAt && (
              <Text style={styles.dateText}>{new Date(item.validatedAt).toLocaleDateString('de-DE')}</Text>
            )}
          </View>
          <StatusBadge status={item.validationStatus} />
        </View>

        <Text style={styles.customerName} numberOfLines={1}>{item.customerName}</Text>

        <View style={styles.addressRow}>
          <MapPin size={13} color={colors.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressText} numberOfLines={1}>{item.shippingStreet}</Text>
            <Text style={styles.addressText} numberOfLines={1}>{item.shippingPostalCode} {item.shippingCity}</Text>
          </View>
        </View>

        {item.changes && item.changes.length > 0 && (
          <View style={styles.changesContainer}>
            {item.changes.map((change, i) => (
              <Text key={i} style={styles.changeItem}>• {change}</Text>
            ))}
          </View>
        )}

        {showActions && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.cardActionBtn, styles.cardActionBtnSecondary]}
              onPress={() => handleValidateSingle(item)}
              disabled={isSingleValidating}
              activeOpacity={0.7}
            >
              {isSingleValidating
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={[styles.cardActionBtnText, { color: colors.primary }]}>Prüfen</Text>
              }
            </TouchableOpacity>

            {(item.validationStatus === 'SUSPECT' || item.validationStatus === 'INVALID') && (
              <>
                <TouchableOpacity
                  style={[styles.cardActionBtn, styles.cardActionBtnSecondary]}
                  onPress={() => setKorrekturItem(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cardActionBtnText, { color: colors.warning }]}>Korrigieren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cardActionBtn, styles.cardActionBtnSecondary]}
                  onPress={() => { setAutoGoogleCheck(true); setKorrekturItem(item) }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cardActionBtnText, { color: '#a855f7' }]}>Google</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.cardActionBtn, styles.cardActionBtnSecondary]}
              onPress={() => handleMarkValid(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardActionBtnText, { color: colors.success }]}>Als gültig</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={[styles.statBadge, { backgroundColor: '#22c55e20' }]}>
          <CheckCircle size={13} color="#22c55e" />
          <Text style={[styles.statText, { color: '#22c55e' }]}>{stats.ok} OK</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: '#f59e0b20' }]}>
          <AlertTriangle size={13} color="#f59e0b" />
          <Text style={[styles.statText, { color: '#f59e0b' }]}>{stats.vorschlag} Vorschlag</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: '#ef444420' }]}>
          <XCircle size={13} color="#ef4444" />
          <Text style={[styles.statText, { color: '#ef4444' }]}>{stats.ungueltig} Ungültig</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: '#6b728020' }]}>
          <Clock size={13} color="#6b7280" />
          <Text style={[styles.statText, { color: '#6b7280' }]}>{stats.offen} Offen</Text>
        </View>
      </View>

      {/* Filter tabs */}
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

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Auftragsnr., Kundenname..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Alle prüfen button */}
      <TouchableOpacity
        style={[styles.validateAllBtn, validatingAll && styles.validateAllBtnDisabled]}
        onPress={handleValidateAll}
        disabled={validatingAll}
        activeOpacity={0.7}
      >
        {validatingAll
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.validateAllBtnText}>Alle offenen prüfen ({stats.offen})</Text>
        }
      </TouchableOpacity>

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{String((error as Error)?.message || 'Fehler')}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Keine Einträge gefunden</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.orderId)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {/* Korrektur Modal */}
      {korrekturItem && (
        <KorrekturModal
          item={korrekturItem}
          onClose={() => { setKorrekturItem(null); setAutoGoogleCheck(false) }}
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ['adressvalidierung'] })}
          autoGoogle={autoGoogleCheck}
        />
      )}
    </View>
  )
}

function createStyles() { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
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
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: colors.text,
    fontSize: 15,
  },
  validateAllBtn: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  validateAllBtnDisabled: {
    opacity: 0.6,
  },
  validateAllBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
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
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  customerName: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  changesContainer: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  changeItem: {
    fontSize: 11,
    color: colors.warning,
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexWrap: 'wrap',
  },
  cardActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardActionBtnSecondary: {
    backgroundColor: colors.border,
  },
  cardActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  modalCloseBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalCloseBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  modalScroll: {
    padding: spacing.md,
  },
  modalSection: {
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  sectionOriginal: {
    backgroundColor: '#ef444410',
    borderColor: '#ef444430',
  },
  sectionSuggestion: {
    backgroundColor: '#3b82f610',
    borderColor: '#3b82f630',
  },
  sectionGoogle: {
    backgroundColor: '#8b5cf610',
    borderColor: '#8b5cf630',
  },
  sectionCorrection: {
    backgroundColor: '#22c55e10',
    borderColor: '#22c55e30',
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalSectionText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 14,
  },
  modalActions: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnSecondary: {
    backgroundColor: colors.border,
  },
  actionBtnWarning: {
    backgroundColor: colors.warning,
  },
  actionBtnSuccess: {
    backgroundColor: colors.success,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
}) }
