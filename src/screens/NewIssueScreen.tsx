import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Image, Alert } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { Camera as CameraIcon, ImagePlus, X, ArrowLeft } from 'lucide-react-native'
import { fetchIssueCategories, createIssue, IssuePhotoInput } from '../lib/api'
import { colors } from '../theme'

export function NewIssueScreen({ onBack }: { onBack: () => void }) {
  const styles = createStyles()
  const { data: categories = [] } = useQuery({
    queryKey: ['issue-categories'],
    queryFn: () => fetchIssueCategories(),
  })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [photos, setPhotos] = useState<IssuePhotoInput[]>([])
  const [sending, setSending] = useState(false)

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) return Alert.alert('Keine Kamera-Berechtigung')
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

  function addPhoto(asset: ImagePicker.ImagePickerAsset) {
    if (photos.length >= 5) return Alert.alert('Maximal 5 Fotos')
    const filename = asset.fileName || `photo_${Date.now()}.jpg`
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
    const type =
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      ext === 'heic' ? 'image/heic' :
      'image/jpeg'
    setPhotos(p => [...p, { uri: asset.uri, name: filename, type }])
  }

  function removePhoto(idx: number) {
    setPhotos(p => p.filter((_, i) => i !== idx))
  }

  const canSubmit = title.trim().length > 0 && description.trim().length > 0
    && categoryId !== null && photos.length > 0 && !sending

  async function submit() {
    if (!canSubmit || categoryId === null) return
    setSending(true)
    try {
      const res = await createIssue({
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        photos,
      })
      if (res.success) {
        Alert.alert('Gemeldet', 'Dein Fehler wurde uebermittelt.')
        onBack()
      } else {
        Alert.alert('Fehler', res.error || 'Unbekannter Fehler')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} style={{ padding: 8 }}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fehler melden</Text>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Titel *</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} maxLength={200}
        placeholder="z.B. Drucker druckt nicht" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Kategorie *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {categories.map(c => (
          <TouchableOpacity key={c.id} onPress={() => setCategoryId(c.id)}
            style={[styles.chip, categoryId === c.id && styles.chipActive]}>
            <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>Beschreibung *</Text>
      <TextInput value={description} onChangeText={setDescription}
        style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
        multiline maxLength={5000}
        placeholder="Was ist passiert?" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Fotos * (1-5)</Text>
      <View style={styles.photoRow}>
        {photos.map((p, i) => (
          <View key={i} style={styles.photoBox}>
            <Image source={{ uri: p.uri }} style={styles.photoImg} />
            <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
              <X size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < 5 && (
          <>
            <TouchableOpacity style={styles.photoAdd} onPress={pickFromCamera}>
              <CameraIcon size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoAdd} onPress={pickFromGallery}>
              <ImagePlus size={22} color={colors.text} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity onPress={submit} disabled={!canSubmit}
        style={[styles.submit, !canSubmit && { opacity: 0.4 }]}>
        <Text style={styles.submitText}>{sending ? 'Sende…' : 'Senden'}</Text>
      </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function createStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerBar: { flexDirection: 'row', alignItems: 'center', padding: 6, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    headerTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginLeft: 6 },
    label: { color: colors.text, fontWeight: '600', marginTop: 12, marginBottom: 6 },
    input: { backgroundColor: colors.surface, color: colors.text, borderRadius: 8, padding: 12, fontSize: 14 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface, marginRight: 6 },
    chipActive: { backgroundColor: colors.primary },
    chipText: { color: colors.text },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    photoBox: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface },
    photoImg: { width: '100%', height: '100%' },
    photoRemove: { position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    photoAdd: { width: 80, height: 80, borderRadius: 8, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
    submit: { backgroundColor: colors.primary, padding: 14, borderRadius: 8, marginTop: 20 },
    submitText: { color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 15 },
  })
}
