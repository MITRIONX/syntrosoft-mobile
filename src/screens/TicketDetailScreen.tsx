import { useRef } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, Lock, User, Bot, Settings } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import RenderHtml from 'react-native-render-html'
import { api, Ticket, TicketMessage, TicketDetail } from '../lib/api'
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

function ColorBadge({ name, color }: { name: string; color: string }) {
  const bg = color && color.startsWith('#') ? color : '#6b7280'
  return (
    <View style={[styles.badge, { backgroundColor: bg + '25', borderColor: bg + '50' }]}>
      <Text style={[styles.badgeText, { color: bg }]}>{name}</Text>
    </View>
  )
}

function MessageContent({ msg, isAgent }: { msg: TicketMessage; isAgent: boolean }) {
  const { width } = useWindowDimensions()
  const contentWidth = width * 0.78 - 40 // bubble maxWidth minus padding

  if (msg.body_html) {
    const htmlStyles = {
      body: { color: colors.text, fontSize: 14, lineHeight: 20 },
      p: { marginTop: 0, marginBottom: 8 },
      a: { color: colors.primary },
      table: { borderColor: colors.border },
      td: { padding: 4, borderColor: colors.border, borderWidth: 0.5 },
      th: { padding: 4, borderColor: colors.border, borderWidth: 0.5, fontWeight: '600' as const },
      img: { maxWidth: contentWidth },
    }
    return (
      <RenderHtml
        contentWidth={contentWidth}
        source={{ html: msg.body_html }}
        tagsStyles={htmlStyles}
        defaultTextProps={{ selectable: true }}
        enableExperimentalMarginCollapsing
      />
    )
  }

  const bodyText = decodeHtmlEntities(msg.body) || '(Kein Textinhalt)'
  return (
    <Text
      style={[styles.bubbleBody, isAgent ? styles.bubbleBodyAgent : styles.bubbleBodyCustomer]}
      selectable
    >
      {bodyText}
    </Text>
  )
}

function MessageBubble({ msg }: { msg: TicketMessage }) {
  const isAgent = msg.sender_type === 'agent'
  const isSystem = msg.sender_type === 'system' || msg.is_internal_note

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

  return (
    <View style={[styles.bubbleWrapper, isAgent ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
      {!isAgent && (
        <View style={styles.avatarCircle}>
          <User size={14} color={colors.textMuted} />
        </View>
      )}
      <View style={[styles.bubble, isAgent ? styles.bubbleAgent : styles.bubbleCustomer]}>
        <View style={styles.bubbleMeta}>
          <Text style={[styles.bubbleSender, isAgent ? styles.bubbleSenderAgent : styles.bubbleSenderCustomer]}>
            {msg.sender_name || (isAgent ? 'Agent' : 'Kunde')}
          </Text>
          <Text style={styles.bubbleTime}>{timeAgo(msg.created_at)}</Text>
        </View>
        <MessageContent msg={msg} isAgent={isAgent} />
        {msg.has_attachments && (
          <Text style={styles.bubbleAttachment}>Anhang vorhanden</Text>
        )}
      </View>
      {isAgent && (
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['ticket', ticket.id],
    queryFn: () => api.getTicket(ticket.id),
  })

  const detail: TicketDetail | undefined = data?.data
  const messages = detail?.ticket_messages || []
  const contactName = ticket.customer_display_name || ticket.supplier_display_name || ticket.customer_email || null

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
              {detail.status_name && <ColorBadge name={detail.status_name} color={detail.status_color} />}
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
              renderItem={({ item }) => <MessageBubble msg={item} />}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            />
          )}
        </>
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
    maxWidth: '78%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
