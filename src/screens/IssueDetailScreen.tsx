import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Image, Alert } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { Send, Camera as CameraIcon, ImagePlus, X } from 'lucide-react-native'
import {
  fetchIssueDetail,
  fetchIssueMessages,
  sendIssueMessage,
  issueAttachmentUrl,
  IssuePhotoInput,
  IssueMessage,
  IssueStatus,
} from '../lib/api'
import { colors } from '../theme'

const STATUS_LABEL: Record<IssueStatus, { label: string; color: string }> = {
  neu: { label: 'Neu', color: '#dc2626' },
  in_bearbeitung: { label: 'In Bearbeitung', color: '#d97706' },
  erledigt: { label: 'Erledigt', color: '#16a34a' },
}

function AttachmentImage({ attachmentId, style }: { attachmentId: number; style: any }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    issueAttachmentUrl(attachmentId).then(u => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [attachmentId])
  if (!url) return <View style={[style, { backgroundColor: colors.surface }]} />
  return <Image source={{ uri: url }} style={style} />
}

export function IssueDetailScreen({ route }: any) {
  const styles = createStyles()
  const id: number = route.params.id
  const qc = useQueryClient()

  const { data: det } = useQuery({
    queryKey: ['issue-detail', id],
    queryFn: () => fetchIssueDetail(id),
    refetchInterval: 15000,
  })

  const { data: messages = [] } = useQuery<IssueMessage[]>({
    queryKey: ['issue-messages', id],
    queryFn: () => fetchIssueMessages(id),
    refetchInterval: 15000,
  })

  const [text, setText] = useState('')
  const [photos, setPhotos] = useState<IssuePhotoInput[]>([])
  const [sending, setSending] = useState(false)

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) return
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 })
    if (!r.canceled && r.assets[0]) addPhoto(r.assets[0])
  }

  async function pickFromGallery() {
    const r = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
      quality: 0.7,
    })
    if (!r.canceled) r.assets.forEach(addPhoto)
  }

  function addPhoto(a: ImagePicker.ImagePickerAsset) {
    if (photos.length >= 5) return
    const filename = a.fileName || `photo_${Date.now()}.jpg`
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
    const type =
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      ext === 'heic' ? 'image/heic' :
      'image/jpeg'
    setPhotos(p => [...p, { uri: a.uri, name: filename, type }])
  }

  async function submit() {
    if (!text.trim() || sending) return
    setSending(true)
    const res = await sendIssueMessage(id, text.trim(), photos)
    setSending(false)
    if (res.success) {
      setText('')
      setPhotos([])
      qc.invalidateQueries({ queryKey: ['issue-messages', id] })
      qc.invalidateQueries({ queryKey: ['issue-detail', id] })
    } else {
      Alert.alert('Fehler', res.error || 'Senden fehlgeschlagen')
    }
  }

  if (!det?.issue) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>Lade…</Text>
      </View>
    )
  }

  const issue = det.issue
  const initial = (det.attachments || []).filter(a => a.message_id === null)
  const status = STATUS_LABEL[issue.status] || STATUS_LABEL.neu

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.statusPill, { backgroundColor: status.color }]}>
          <Text style={styles.statusText}>{status.label}</Text>
        </View>
        <Text style={styles.title}>{issue.title}</Text>
        <Text style={styles.meta}>{issue.category_name} · #{issue.id}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        <View style={styles.bubbleOwn}>
          <Text style={styles.bubbleSender}>Du · {new Date(issue.created_at).toLocaleString('de-DE')}</Text>
          <Text style={styles.bubbleText}>{issue.description}</Text>
          {initial.length > 0 && (
            <ScrollView horizontal style={{ marginTop: 8 }}>
              {initial.map(a => <AttachmentImage key={a.id} attachmentId={a.id} style={styles.thumb} />)}
            </ScrollView>
          )}
        </View>

        {messages.map(m => (
          <View key={m.id} style={m.sender_type === 'tenant' ? styles.bubbleOwn : styles.bubbleAdmin}>
            <Text style={styles.bubbleSender}>
              {m.sender_type === 'tenant' ? 'Du' : m.sender_name} · {new Date(m.created_at).toLocaleString('de-DE')}
            </Text>
            <Text style={styles.bubbleText}>{m.content}</Text>
            {m.attachments && m.attachments.length > 0 && (
              <ScrollView horizontal style={{ marginTop: 8 }}>
                {m.attachments.map(a => <AttachmentImage key={a.id} attachmentId={a.id} style={styles.thumb} />)}
              </ScrollView>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        {photos.length > 0 && (
          <ScrollView horizontal style={{ marginBottom: 6 }}>
            {photos.map((p, i) => (
              <View key={i} style={{ marginRight: 6 }}>
                <Image source={{ uri: p.uri }} style={styles.thumb} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhotos(arr => arr.filter((_, j) => j !== i))}>
                  <X size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          <TouchableOpacity onPress={pickFromCamera} style={styles.iconBtn}>
            <CameraIcon size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={pickFromGallery} style={styles.iconBtn}>
            <ImagePlus size={20} color={colors.text} />
          </TouchableOpacity>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Antwort schreiben…"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.textInput}
          />
          <TouchableOpacity
            onPress={submit}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}>
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

function createStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: 12, borderBottomWidth: 1, borderColor: colors.border },
    statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    statusText: { color: '#fff', fontWeight: '700', fontSize: 11 },
    title: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 6 },
    meta: { color: colors.textMuted, marginTop: 2 },
    bubbleOwn: { backgroundColor: colors.primary, alignSelf: 'flex-end', maxWidth: '85%', padding: 10, borderRadius: 12, marginBottom: 8 },
    bubbleAdmin: { backgroundColor: colors.surface, alignSelf: 'flex-start', maxWidth: '85%', padding: 10, borderRadius: 12, marginBottom: 8 },
    bubbleSender: { color: '#fff', fontSize: 11, marginBottom: 4, opacity: 0.7 },
    bubbleText: { color: '#fff' },
    thumb: { width: 70, height: 70, borderRadius: 6, marginRight: 6 },
    inputRow: { padding: 8, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    iconBtn: { padding: 8 },
    textInput: { flex: 1, backgroundColor: colors.surface, color: colors.text, padding: 10, borderRadius: 18, maxHeight: 100, fontSize: 14 },
    sendBtn: { backgroundColor: colors.primary, padding: 10, borderRadius: 20 },
    photoRemove: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    muted: { color: colors.textMuted, padding: 20, textAlign: 'center' },
  })
}
