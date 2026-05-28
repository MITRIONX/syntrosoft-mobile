import { useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect } from '@react-navigation/native'
import { Plus, AlertCircle, Loader, CheckCircle2, Image as ImageIcon } from 'lucide-react-native'
import { fetchIssues, Issue, IssueStatus } from '../lib/api'
import { colors } from '../theme'

const STATUS_META: Record<IssueStatus, { label: string; color: string; Icon: any }> = {
  neu: { label: 'NEU', color: '#dc2626', Icon: AlertCircle },
  in_bearbeitung: { label: 'IN BEARBEITUNG', color: '#d97706', Icon: Loader },
  erledigt: { label: 'ERLEDIGT', color: '#16a34a', Icon: CheckCircle2 },
}

type Filter = 'all' | IssueStatus

export function IssuesScreen({ navigation }: any) {
  const styles = createStyles()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')

  const { data: issues = [], refetch, isLoading, isFetching } = useQuery({
    queryKey: ['issues', filter],
    queryFn: () => fetchIssues(filter === 'all' ? undefined : filter),
    refetchInterval: 30000,
  })

  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey: ['issues'] })
  }, [qc]))

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        {(['all','neu','in_bearbeitung','erledigt'] as const).map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'Alle' : STATUS_META[f].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={issues}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{isLoading ? 'Lade…' : 'Keine Fehler-Meldungen.'}</Text>
        }
        renderItem={({ item }) => (
          <IssueRow item={item} onPress={() => navigation.navigate('IssueDetail', { id: item.id })} />
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('NewIssue')}>
        <Plus size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

function IssueRow({ item, onPress }: { item: Issue; onPress: () => void }) {
  const styles = createStyles()
  const meta = STATUS_META[item.status] || STATUS_META.neu
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={[styles.statusPill, { backgroundColor: meta.color }]}>
        <meta.Icon size={12} color="#fff" />
        <Text style={styles.statusText}>{meta.label}</Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
      <View style={styles.meta}>
        {item.attachment_count > 0 && (
          <View style={styles.metaItem}>
            <ImageIcon size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>{item.attachment_count}</Text>
          </View>
        )}
        <Text style={styles.metaText}>{item.category_name}</Text>
        {item.unread_tenant > 0 && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  )
}

function createStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    filterBar: { flexDirection: 'row', padding: 8, gap: 6, borderBottomWidth: 1, borderColor: colors.border },
    filterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface },
    filterChipActive: { backgroundColor: colors.primary },
    filterChipText: { color: colors.text, fontSize: 12 },
    filterChipTextActive: { color: '#fff', fontWeight: '600' },
    row: { backgroundColor: colors.surface, padding: 12, marginBottom: 8, borderRadius: 8 },
    statusPill: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginBottom: 6 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    title: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { color: colors.textMuted, fontSize: 12 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 'auto' },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 50 },
    fab: { position: 'absolute', right: 18, bottom: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  })
}
