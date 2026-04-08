import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { LogOut, Smartphone, Server, User } from 'lucide-react-native'
import { ConnectionInfo, clearConnectionInfo } from '../lib/auth'
import { colors, spacing } from '../theme'

interface SettingsScreenProps {
  connection: ConnectionInfo
  onDisconnect: () => void
}

export function SettingsScreen({ connection, onDisconnect }: SettingsScreenProps) {
  const handleDisconnect = () => {
    Alert.alert(
      'Verbindung trennen',
      'Moechten Sie die Verbindung zu SyntroSoft wirklich trennen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Trennen',
          style: 'destructive',
          onPress: async () => {
            await clearConnectionInfo()
            onDisconnect()
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Verbindung</Text>

        <View style={styles.row}>
          <Server size={16} color={colors.textMuted} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Firma</Text>
            <Text style={styles.rowValue}>{connection.tenantName}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <User size={16} color={colors.textMuted} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Benutzer</Text>
            <Text style={styles.rowValue}>{connection.userName}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Smartphone size={16} color={colors.textMuted} />
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Server</Text>
            <Text style={styles.rowValue}>{connection.serverUrl}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
        <LogOut size={18} color={colors.danger} />
        <Text style={styles.disconnectText}>Verbindung trennen</Text>
      </TouchableOpacity>

      <Text style={styles.version}>SyntroSoft Mobile v1.0.0</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    paddingTop: 100,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: 15,
    color: colors.text,
    marginTop: 2,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger + '30',
  },
  disconnectText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.danger,
  },
  version: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xl,
  },
})
