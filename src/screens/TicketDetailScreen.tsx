import { useRef, useState } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Modal, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Lock, User, Bot, Settings, Paperclip, FileText, Image as ImageIcon, File, ChevronDown, X, Check } from 'lucide-react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { WebView } from 'react-native-webview'
import { api, Ticket, TicketMessage, TicketAttachment, TicketDetail, TicketStatus, TicketAgent } from '../lib/api'
import { colors, spacing } from '../theme'

interface TicketDetailScreenProps {
  ticket: Ticket
  onBack: () => void
}

function decodeHtmlEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&zwnj;/gi, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#\d+;/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr).getTime()
  if (isNaN(d) || d < 86400000) return ''
  const now = Date.now()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return `vor ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)}h`
  if (diff < 172800) return 'gestern'
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function ColorBadge({ name, color, onPress }: { name: string; color: string; onPress?: () => void }) {
  const bg = color && color.startsWith('#') ? color : '#6b7280'
  const content = (
    <View style={[styles.badge, { backgroundColor: bg + '25', borderColor: bg + '50' }]}>
      <Text style={[styles.badgeText, { color: bg }]}>{name}</Text>
      {onPress && <ChevronDown size={10} color={bg} style={{ marginLeft: 2 }} />}
    </View>
  )
  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>
  }
  return content
}

function PickerModal<T extends { id: number; name: string; color?: string }>({ visible, title, items, selectedId, onSelect, onClose, allowNone }: {
  visible: boolean; title: string; items: T[]; selectedId: number | null; onSelect: (id: number | null) => void; onClose: () => void; allowNone?: boolean
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={colors.text} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList}>
            {allowNone && (
              <TouchableOpacity style={styles.modalItem} onPress={() => { onSelect(null); onClose() }}>
                <Text style={styles.modalItemText}>— Nicht zugewiesen —</Text>
                {selectedId === null && <Check size={16} color={colors.primary} />}
              </TouchableOpacity>
            )}
            {items.map(item => {
              const isSelected = item.id === selectedId
              const itemColor = (item as any).color
              return (
                <TouchableOpacity key={item.id} style={styles.modalItem} onPress={() => { onSelect(item.id); onClose() }}>
                  {itemColor && <View style={[styles.modalDot, { backgroundColor: itemColor }]} />}
                  <Text style={[styles.modalItemText, isSelected && { color: colors.primary, fontWeight: '600' }]}>{item.name}</Text>
                  {isSelected && <Check size={16} color={colors.primary} />}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function MessageContent({ msg, isAgent }: { msg: TicketMessage; isAgent: boolean }) {
  const [webViewHeight, setWebViewHeight] = useState(100)

  if (msg.body_html) {
    const darkModeWrapper = `
      <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=yes">
        <style>
          * { color: ${colors.text} !important; background-color: transparent !important; }
          body { margin: 0; padding: 0; font-family: -apple-system, sans-serif; font-size: 14px; line-height: 1.5; overflow-x: hidden; }
          a { color: ${colors.primary} !important; }
          img { max-width: 100% !important; height: auto !important; }
          body > table, body > div, body > center { width: 100% !important; max-width: 100% !important; }
          body > center > table, body > div > table { width: 100% !important; max-width: 100% !important; }
          td, th { color: ${colors.text} !important; }
        </style>
      </head><body>${msg.body_html}</body></html>
    `
    return (
      <View style={{ minHeight: 60, height: webViewHeight }}>
        <WebView
          source={{ html: darkModeWrapper }}
          style={{ backgroundColor: 'transparent', opacity: 0.99 }}
          scrollEnabled={false}
          originWhitelist={['*']}
          onMessage={(e) => {
            const h = parseInt(e.nativeEvent.data, 10)
            if (h > 0) setWebViewHeight(h + 16)
          }}
          injectedJavaScript={`
            setTimeout(() => {
              var cw = document.body.scrollWidth;
              var vw = window.innerWidth;
              if (cw > vw) {
                var scale = vw / cw;
                document.body.style.transform = 'scale(' + scale + ')';
                document.body.style.transformOrigin = 'top left';
                document.body.style.width = (100 / scale) + '%';
              }
              setTimeout(() => {
                window.ReactNativeWebView.postMessage(String(document.body.scrollHeight));
              }, 100);
            }, 200);
            true;
          `}
          onShouldStartLoadWithRequest={(req) => {
            if (req.url !== 'about:blank' && !req.url.startsWith('data:')) {
              Linking.openURL(req.url)
              return false
            }
            return true
          }}
        />
      </View>
    )
  }

  const bodyText = decodeHtmlEntities(msg.body) || '(Kein Textinhalt)'
  return (
    <Text style={[styles.bubbleBody, isAgent ? styles.bubbleBodyAgent : styles.bubbleBodyCustomer]} selectable>
      {bodyText}
    </Text>
  )
}

function getFileIcon(mimeType: string | null) {
  if (mimeType?.startsWith('image/')) return ImageIcon
  if (mimeType === 'application/pdf') return FileText
  return File
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentList({ attachments }: { attachments: TicketAttachment[] }) {
  const nonInline = attachments.filter(a => !a.is_inline)
  if (nonInline.length === 0) return null

  const openAttachment = async (att: TicketAttachment) => {
    try {
      const url = await api.getTicketAttachmentUrl(att.id)
      Linking.openURL(url)
    } catch {}
  }

  return (
    <View style={styles.attachmentList}>
      {nonInline.map(att => {
        const Icon = getFileIcon(att.mime_type)
        return (
          <TouchableOpacity key={att.id} style={styles.attachmentItem} onPress={() => openAttachment(att)} activeOpacity={0.7}>
            <Icon size={16} color={colors.primary} />
            <Text style={styles.attachmentName} numberOfLines={1}>{att.filename}</Text>
            {att.file_size && <Text style={styles.attachmentSize}>{formatFileSize(att.file_size)}</Text>}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function MessageBubble({ msg, attachments }: { msg: TicketMessage; attachments: TicketAttachment[] }) {
  const isAgent = msg.sender_type === 'agent'
  const isSystem = msg.sender_type === 'system' || msg.is_internal_note
  const msgAttachments = attachments.filter(a => a.message_id === msg.id)

  if (isSystem) {
    const bodyText = decodeHtmlEntities(msg.body) || '(Kein Textinhalt)'
    return (
      <View style={styles.systemNote}>
        {msg.is_internal_note && (
          <View style={styles.systemNoteHeader}>
            <Lock size={11} color={colors.textMuted} />
            <Text style={styles.systemNoteLabel}>Interne Notiz</Text>
          </View>
        )}
        <Text style={styles.systemNoteText}>{bodyText}</Text>
        <Text style={styles.systemNoteTime}>{timeAgo(msg.created_at)}</Text>
      </View>
    )
  }

  const hasHtml = !!msg.body_html

  return (
    <View style={[styles.bubbleWrapper, isAgent ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
      {!isAgent && !hasHtml && (
        <View style={styles.avatarCircle}>
          <User size={14} color={colors.textMuted} />
        </View>
      )}
      <View style={[styles.bubble, isAgent ? styles.bubbleAgent : styles.bubbleCustomer, hasHtml && styles.bubbleFullWidth]}>
        <View style={styles.bubbleMeta}>
          <Text style={[styles.bubbleSender, isAgent ? styles.bubbleSenderAgent : styles.bubbleSenderCustomer]}>
            {msg.sender_name || (isAgent ? 'Agent' : 'Kunde')}
          </Text>
          <Text style={styles.bubbleTime}>{timeAgo(msg.created_at)}</Text>
        </View>
        <MessageContent msg={msg} isAgent={isAgent} />
        {msgAttachments.length > 0 && <AttachmentList attachments={msgAttachments} />}
      </View>
      {isAgent && !hasHtml && (
        <View style={[styles.avatarCircle, styles.avatarCircleAgent]}>
          <Bot size={14} color={colors.primary} />
        </View>
      )}
    </View>
  )
}

export function TicketDetailScreen({ ticket, onBack }: TicketDetailScreenProps) {
  const insets = useSafeAreaInsets()
  const listRef = useRef<FlatList>(null)
  const queryClient = useQueryClient()
  const [statusModalVisible, setStatusModalVisible] = useState(false)
  const [agentModalVisible, setAgentModalVisible] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['ticket', ticket.id],
    queryFn: () => api.getTicket(ticket.id),
  })

  const { data: attachmentsData } = useQuery({
    queryKey: ['ticket-attachments', ticket.id],
    queryFn: () => api.getTicketAttachments(ticket.id),
  })

  const { data: statusesData } = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn: () => api.getTicketStatuses(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: agentsData } = useQuery({
    queryKey: ['ticket-agents'],
    queryFn: () => api.getTicketAgents(),
    staleTime: 5 * 60 * 1000,
  })

  const detail: TicketDetail | undefined = data?.data
  const messages = detail?.ticket_messages || []
  const attachments = attachmentsData?.attachments || []
  const statuses = (statusesData?.statuses || []).filter((s: TicketStatus) => s.is_active)
  const agents = (agentsData?.agents || []).filter((a: TicketAgent) => a.is_active)
  const contactName = ticket.customer_display_name || ticket.supplier_display_name || ticket.customer_email || null

  const handleUpdateStatus = async (statusId: number | null) => {
    if (!statusId || !detail) return
    try {
      await api.updateTicket(ticket.id, { status_id: statusId })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    } catch {}
  }

  const handleUpdateAgent = async (agentId: number | null) => {
    if (!detail) return
    try {
      await api.updateTicket(ticket.id, { assigned_user_id: agentId })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    } catch {}
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTicketNumber}>{ticket.ticket_number?.startsWith('#') ? '' : '#'}{ticket.ticket_number}</Text>
          <Text style={styles.headerSubject} numberOfLines={1}>{ticket.subject}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{String((error as Error)?.message || 'Unbekannter Fehler')}</Text>
        </View>
      ) : detail ? (
        <>
          {/* Meta info bar */}
          <View style={styles.metaBar}>
            <View style={styles.metaRow}>
              {detail.status_name && <ColorBadge name={detail.status_name} color={detail.status_color} onPress={() => setStatusModalVisible(true)} />}
              {detail.priority_name && detail.priority_color && (
                <ColorBadge name={detail.priority_name} color={detail.priority_color} />
              )}
              {detail.group_name && (
                <View style={styles.groupChip}>
                  <Settings size={11} color={colors.textMuted} />
                  <Text style={styles.groupChipText}>{detail.group_name}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.contactRow} onPress={() => setAgentModalVisible(true)} activeOpacity={0.7}>
              <User size={12} color={colors.textMuted} />
              <Text style={styles.contactText}>{(detail as any).assigned_to || 'Nicht zugewiesen'}</Text>
              <ChevronDown size={12} color={colors.textMuted} />
            </TouchableOpacity>
            {contactName && (
              <View style={styles.contactRow}>
                <User size={12} color={colors.textMuted} />
                <Text style={styles.contactText}>{contactName}</Text>
              </View>
            )}
          </View>

          {/* Chat messages */}
          {messages.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Keine Nachrichten</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              renderItem={({ item }) => <MessageBubble msg={item} attachments={attachments} />}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            />
          )}
        </>
      ) : null}

      <PickerModal
        visible={statusModalVisible}
        title="Status ändern"
        items={statuses}
        selectedId={(detail as any)?.status_id || null}
        onSelect={handleUpdateStatus}
        onClose={() => setStatusModalVisible(false)}
      />

      <PickerModal
        visible={agentModalVisible}
        title="Bearbeiter zuweisen"
        items={agents}
        selectedId={(detail as any)?.assigned_user_id || null}
        onSelect={handleUpdateAgent}
        onClose={() => setAgentModalVisible(false)}
        allowNone
      />
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
  headerTitles: {
    flex: 1,
    minWidth: 0,
  },
  headerTicketNumber: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  headerSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 1,
  },
  metaBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
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
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  groupChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  contactText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  messageList: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  // Customer bubble (left)
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    gap: 8,
  },
  bubbleWrapperLeft: {
    justifyContent: 'flex-start',
  },
  bubbleWrapperRight: {
    justifyContent: 'flex-end',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarCircleAgent: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary + '30',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleFullWidth: {
    maxWidth: '100%',
    flex: 1,
  },
  bubbleCustomer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleAgent: {
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary + '35',
    borderBottomRightRadius: 4,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  bubbleSender: {
    fontSize: 11,
    fontWeight: '600',
  },
  bubbleSenderCustomer: {
    color: colors.textMuted,
  },
  bubbleSenderAgent: {
    color: colors.primary,
  },
  bubbleTime: {
    fontSize: 10,
    color: colors.textMuted,
  },
  bubbleBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleBodyCustomer: {
    color: colors.text,
  },
  bubbleBodyAgent: {
    color: colors.text,
  },
  bubbleAttachment: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  attachmentList: {
    marginTop: 8,
    gap: 4,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachmentName: {
    flex: 1,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  attachmentSize: {
    fontSize: 10,
    color: colors.textMuted,
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
    maxHeight: '60%',
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
  modalList: {
    paddingHorizontal: spacing.md,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  modalDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  modalItemText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  // System / internal note
  systemNote: {
    alignSelf: 'center',
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  systemNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  systemNoteLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  systemNoteText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 17,
    textAlign: 'center',
  },
  systemNoteTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
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
})
