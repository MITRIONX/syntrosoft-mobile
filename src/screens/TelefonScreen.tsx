import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone, UserPlus, Search, X, Check } from 'lucide-react-native'
import { api, CallLogEntry, Kunde } from '../lib/api'
import { colors, spacing } from '../theme'

interface TelefonScreenProps {
  onSelectKunde?: (kundeId: number) => void
}

type CallFilter = 'alle' | 'verpasst'

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  if (isToday) return time
  if (isYesterday) return `Gestern ${time}`
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}. ${time}`
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return ''
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function CallIcon({ call }: { call: CallLogEntry }) {
  if (call.status === 'missed') return <PhoneMissed size={18} color="#ef4444" />
  if (call.direction === 'in') return <PhoneIncoming size={18} color="#22c55e" />
  return <PhoneOutgoing size={18} color="#3b82f6" />
}

function StatusColor(status: string): string {
  switch (status) {
    case 'missed': return '#ef4444'
    case 'answered': case 'completed': return '#22c55e'
    case 'busy': return '#f59e0b'
    default: return '#6b7280'
  }
}

function StatusLabel(status: string): string {
  switch (status) {
    case 'missed': return 'Verpasst'
    case 'answered': return 'Angenommen'
    case 'completed': return 'Beendet'
    case 'busy': return 'Besetzt'
    case 'ringing': return 'Klingelt'
    default: return status
  }
}

export function TelefonScreen({ onSelectKunde }: TelefonScreenProps) {
  const styles = createStyles()
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState<CallFilter>('alle')
  const [assignCall, setAssignCall] = useState<CallLogEntry | null>(null)
  const [assignMode, setAssignMode] = useState<'search' | 'create'>('search')
  const [searchText, setSearchText] = useState('')
  const [newCustomer, setNewCustomer] = useState({ company_name: '', first_name: '', last_name: '', phone: '', email: '' })
  const [saving, setSaving] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['calls', activeFilter],
    queryFn: () => api.searchCalls({
      limit: 100,
      status: activeFilter === 'verpasst' ? 'missed' : undefined,
    }),
  })

  const calls = data?.data || []

  const { data: kundenData } = useQuery({
    queryKey: ['kunden-search', searchText],
    queryFn: () => api.searchKunden(searchText, 20),
    enabled: !!assignCall && assignMode === 'search' && searchText.length >= 2,
  })

  const kundenResults = kundenData?.data || []

  const dialNumber = (number: string) => {
    if (number) Linking.openURL(`tel:${number}`)
  }

  const openAssignModal = (call: CallLogEntry) => {
    const number = call.direction === 'in' ? call.from_number : call.to_number
    setAssignCall(call)
    setAssignMode('search')
    setSearchText('')
    setNewCustomer({ company_name: '', first_name: '', last_name: '', phone: number, email: '' })
  }

  const handleLinkCustomer = async (customerId: number) => {
    if (!assignCall || saving) return
    setSaving(true)
    try {
      await api.linkCallToCustomer(assignCall.id, customerId)
      queryClient.invalidateQueries({ queryKey: ['calls'] })
      setAssignCall(null)
    } catch {}
    setSaving(false)
  }

  const handleCreateCustomer = async () => {
    if (!assignCall || saving) return
    if (!newCustomer.company_name && !newCustomer.last_name) return
    setSaving(true)
    try {
      await api.createCustomerFromCall(assignCall.id, newCustomer)
      queryClient.invalidateQueries({ queryKey: ['calls'] })
      setAssignCall(null)
    } catch {}
    setSaving(false)
  }

  const renderCall = ({ item }: { item: CallLogEntry }) => {
    const displayName = item.caller_name || item.contact_name || null
    const number = item.direction === 'in' ? item.from_number : item.to_number
    const statusColor = StatusColor(item.status)

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <CallIcon call={item} />
        </View>
        <View style={styles.cardCenter}>
          <View style={styles.nameRow}>
            {displayName ? (
              <TouchableOpacity
                onPress={() => item.customer_id && onSelectKunde?.(item.customer_id)}
                disabled={!item.customer_id}
                activeOpacity={0.7}
                style={{ flex: 1 }}
              >
                <Text style={[styles.name, item.customer_id ? styles.nameLink : null]} numberOfLines={1}>
                  {displayName}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => openAssignModal(item)} style={styles.assignButton} activeOpacity={0.7}>
                <UserPlus size={12} color={colors.primary} />
                <Text style={styles.assignText}>Zuweisen</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.time}>{formatTime(item.started_at)}</Text>
          </View>
          <View style={styles.detailRow}>
            <TouchableOpacity onPress={() => dialNumber(number)} activeOpacity={0.7} style={styles.numberButton}>
              <Phone size={11} color={colors.primary} />
              <Text style={styles.number}>{number}</Text>
            </TouchableOpacity>
            {item.duration_seconds && item.duration_seconds > 0 ? (
              <Text style={styles.duration}>{formatDuration(item.duration_seconds)}</Text>
            ) : (
              <View style={[styles.statusDot, { backgroundColor: statusColor + '25' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{StatusLabel(item.status)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.tabs}>
        {([['alle', 'Alle'], ['verpasst', 'Verpasst']] as [CallFilter, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeFilter === key && styles.tabActive]}
            onPress={() => setActiveFilter(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeFilter === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{String((error as Error)?.message || 'Fehler')}</Text>
        </View>
      ) : calls.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{activeFilter === 'verpasst' ? 'Keine verpassten Anrufe' : 'Keine Anrufe'}</Text>
        </View>
      ) : (
        <FlatList
          data={calls}
          renderItem={renderCall}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Assign Modal */}
      <Modal visible={!!assignCall} transparent animationType="slide" onRequestClose={() => setAssignCall(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {assignMode === 'search' ? 'Kunden zuweisen' : 'Neuen Kunden anlegen'}
              </Text>
              <TouchableOpacity onPress={() => setAssignCall(null)}><X size={20} color={colors.text} /></TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.modalTabs}>
              <TouchableOpacity
                style={[styles.modalTab, assignMode === 'search' && styles.modalTabActive]}
                onPress={() => setAssignMode('search')}
              >
                <Text style={[styles.modalTabText, assignMode === 'search' && styles.modalTabTextActive]}>Suchen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalTab, assignMode === 'create' && styles.modalTabActive]}
                onPress={() => setAssignMode('create')}
              >
                <Text style={[styles.modalTabText, assignMode === 'create' && styles.modalTabTextActive]}>Neu anlegen</Text>
              </TouchableOpacity>
            </View>

            {assignMode === 'search' ? (
              <ScrollView style={styles.modalBody}>
                <View style={styles.modalSearchRow}>
                  <Search size={16} color={colors.textMuted} />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Kunde suchen..."
                    placeholderTextColor={colors.textMuted}
                    value={searchText}
                    onChangeText={setSearchText}
                    autoFocus
                  />
                </View>
                {kundenResults.map((k: Kunde) => {
                  const name = k.company_name || [k.first_name, k.last_name].filter(Boolean).join(' ') || k.email || 'Unbekannt'
                  return (
                    <TouchableOpacity key={k.id} style={styles.modalItem} onPress={() => handleLinkCustomer(k.id)} activeOpacity={0.7}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalItemName}>{name}</Text>
                        {k.phone && <Text style={styles.modalItemSub}>{k.phone}</Text>}
                      </View>
                      <Check size={16} color={colors.primary} />
                    </TouchableOpacity>
                  )
                })}
                {searchText.length >= 2 && kundenResults.length === 0 && (
                  <Text style={styles.modalEmpty}>Kein Kunde gefunden</Text>
                )}
              </ScrollView>
            ) : (
              <ScrollView style={styles.modalBody}>
                <Text style={styles.inputLabel}>Firma</Text>
                <TextInput style={styles.modalInput} value={newCustomer.company_name} onChangeText={v => setNewCustomer(c => ({ ...c, company_name: v }))} placeholder="Firma" placeholderTextColor={colors.textMuted} />
                <Text style={styles.inputLabel}>Vorname</Text>
                <TextInput style={styles.modalInput} value={newCustomer.first_name} onChangeText={v => setNewCustomer(c => ({ ...c, first_name: v }))} placeholder="Vorname" placeholderTextColor={colors.textMuted} />
                <Text style={styles.inputLabel}>Nachname</Text>
                <TextInput style={styles.modalInput} value={newCustomer.last_name} onChangeText={v => setNewCustomer(c => ({ ...c, last_name: v }))} placeholder="Nachname" placeholderTextColor={colors.textMuted} />
                <Text style={styles.inputLabel}>Telefon</Text>
                <TextInput style={styles.modalInput} value={newCustomer.phone} onChangeText={v => setNewCustomer(c => ({ ...c, phone: v }))} placeholder="Telefon" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
                <Text style={styles.inputLabel}>E-Mail</Text>
                <TextInput style={styles.modalInput} value={newCustomer.email} onChangeText={v => setNewCustomer(c => ({ ...c, email: v }))} placeholder="E-Mail" placeholderTextColor={colors.textMuted} keyboardType="email-address" />
                <TouchableOpacity
                  style={[styles.createButton, saving && { opacity: 0.5 }]}
                  onPress={handleCreateCustomer}
                  disabled={saving || (!newCustomer.company_name && !newCustomer.last_name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.createButtonText}>{saving ? 'Wird angelegt...' : 'Kunde anlegen & zuweisen'}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
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
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cardLeft: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  cardCenter: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  nameLink: {
    color: colors.primary,
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  numberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  number: {
    fontSize: 13,
    color: colors.primary,
  },
  duration: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusDot: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
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
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  assignText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalTabs: {
    flexDirection: 'row',
    margin: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 3,
  },
  modalTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  modalTabActive: {
    backgroundColor: colors.primary,
  },
  modalTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  modalTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  modalBody: {
    paddingHorizontal: spacing.md,
    maxHeight: 400,
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalSearchInput: {
    flex: 1,
    height: 44,
    color: colors.text,
    fontSize: 15,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemName: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  modalItemSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalEmpty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
}) }
