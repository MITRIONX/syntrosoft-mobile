import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native'
import { ArrowLeft, Building2, User, Mail, Phone, MapPin, Hash } from 'lucide-react-native'
import { Kunde } from '../lib/api'
import { colors, spacing } from '../theme'

interface KundeDetailScreenProps {
  kunde: Kunde
  onBack: () => void
}

export function KundeDetailScreen({ kunde, onBack }: KundeDetailScreenProps) {
  const name = kunde.company_name || [kunde.first_name, kunde.last_name].filter(Boolean).join(' ') || 'Unbenannt'
  const fullAddress = [kunde.street, kunde.house_number].filter(Boolean).join(' ')
  const cityLine = [kunde.postal_code, kunde.city].filter(Boolean).join(' ')

  const handleCall = () => {
    if (kunde.phone) Linking.openURL(`tel:${kunde.phone}`)
  }

  const handleMail = () => {
    if (kunde.email) Linking.openURL(`mailto:${kunde.email}`)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Kundennummer */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Hash size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Kundennummer</Text>
          </View>
          <Text style={styles.cardValue}>{kunde.customer_number}</Text>
        </View>

        {/* Kontakt */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            {kunde.company_name ? (
              <Building2 size={18} color={colors.primary} />
            ) : (
              <User size={18} color={colors.primary} />
            )}
            <Text style={styles.cardTitle}>Kontakt</Text>
          </View>

          {kunde.company_name && (
            <Text style={styles.companyName}>{kunde.company_name}</Text>
          )}
          {(kunde.first_name || kunde.last_name) && (
            <Text style={styles.personName}>
              {[kunde.first_name, kunde.last_name].filter(Boolean).join(' ')}
            </Text>
          )}

          {kunde.phone && (
            <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
              <Phone size={14} color={colors.primary} />
              <Text style={styles.contactLink}>{kunde.phone}</Text>
            </TouchableOpacity>
          )}

          {kunde.email && (
            <TouchableOpacity style={styles.contactRow} onPress={handleMail}>
              <Mail size={14} color={colors.primary} />
              <Text style={styles.contactLink}>{kunde.email}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Adresse */}
        {(fullAddress || cityLine) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Adresse</Text>
            </View>
            {fullAddress && <Text style={styles.addressLine}>{fullAddress}</Text>}
            {cityLine && <Text style={styles.addressLine}>{cityLine}</Text>}
            {kunde.country && <Text style={styles.addressCountry}>{kunde.country}</Text>}
          </View>
        )}

        {/* Status */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.statusDot, { backgroundColor: kunde.is_active ? colors.success : colors.danger }]} />
            <Text style={styles.cardTitle}>Status</Text>
          </View>
          <Text style={[styles.statusText, { color: kunde.is_active ? colors.success : colors.danger }]}>
            {kunde.is_active ? 'Aktiv' : 'Inaktiv'}
          </Text>
        </View>
      </ScrollView>
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
    paddingTop: 50,
    paddingBottom: 16,
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
  content: {
    padding: spacing.md,
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
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  companyName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  personName: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  contactLink: {
    fontSize: 14,
    color: colors.primary,
  },
  addressLine: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  addressCountry: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
