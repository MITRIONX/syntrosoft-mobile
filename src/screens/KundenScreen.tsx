import { useState, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Search, User, Building2, MapPin, Phone } from 'lucide-react-native'
import { api, Kunde } from '../lib/api'
import { colors, spacing } from '../theme'

interface KundenScreenProps {
  onSelectKunde: (kunde: Kunde) => void
}

export function KundenScreen({ onSelectKunde }: KundenScreenProps) {
  const styles = createStyles()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  const handleSearch = useCallback((text: string) => {
    setSearch(text)
    const timeout = setTimeout(() => setDebouncedSearch(text), 300)
    return () => clearTimeout(timeout)
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['kunden', debouncedSearch],
    queryFn: () => api.searchKunden(debouncedSearch, 50),
    enabled: true,
  })

  const kunden = data?.data || []

  const renderKunde = ({ item }: { item: Kunde }) => {
    const name = item.company_name || [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Unbenannt'
    const address = [item.street, item.postal_code, item.city].filter(Boolean).join(', ')

    return (
      <TouchableOpacity style={styles.kundeCard} onPress={() => onSelectKunde(item)} activeOpacity={0.7}>
        <View style={styles.kundeHeader}>
          <View style={styles.kundeIcon}>
            {item.company_name ? (
              <Building2 size={18} color={colors.primary} />
            ) : (
              <User size={18} color={colors.primary} />
            )}
          </View>
          <View style={styles.kundeInfo}>
            <Text style={styles.kundeName} numberOfLines={1}>{name}</Text>
            <Text style={styles.kundeNumber}>#{item.customer_number}</Text>
          </View>
        </View>
        {address ? (
          <View style={styles.kundeDetail}>
            <MapPin size={12} color={colors.textMuted} />
            <Text style={styles.kundeDetailText} numberOfLines={1}>{address}</Text>
          </View>
        ) : null}
        {item.phone ? (
          <View style={styles.kundeDetail}>
            <Phone size={12} color={colors.textMuted} />
            <Text style={styles.kundeDetailText}>{item.phone}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Kunden suchen..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{(error as Error).message}</Text>
        </View>
      ) : kunden.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {debouncedSearch ? 'Keine Kunden gefunden' : 'Suchbegriff eingeben'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={kunden}
          renderItem={renderKunde}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: colors.text,
    fontSize: 16,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  kundeCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kundeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  kundeIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  kundeInfo: {
    flex: 1,
  },
  kundeName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  kundeNumber: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  kundeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingLeft: 44,
  },
  kundeDetailText: {
    fontSize: 13,
    color: colors.textSecondary,
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
}) }
