import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native'
import { LogOut, Smartphone, Server, User, Sun, Moon } from 'lucide-react-native'
import { ConnectionInfo, clearConnectionInfo } from '../lib/auth'
import { useTheme } from '../theme'
import { spacing } from '../theme'

interface SettingsScreenProps {
  connection: ConnectionInfo
  onDisconnect: () => void
}

export function SettingsScreen({ connection, onDisconnect }: SettingsScreenProps) {
  const { mode, colors, toggle } = useTheme()
  const isDark = mode === 'dark'

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Verbindung</Text>

        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Server size={16} color={colors.textMuted} />
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Firma</Text>
            <Text style={[styles.rowValue, { color: colors.text }]}>{connection.tenantName}</Text>
          </View>
        </View>

        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <User size={16} color={colors.textMuted} />
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Benutzer</Text>
            <Text style={[styles.rowValue, { color: colors.text }]}>{connection.userName}</Text>
          </View>
        </View>

        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Smartphone size={16} color={colors.textMuted} />
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Server</Text>
            <Text style={[styles.rowValue, { color: colors.text }]}>{connection.serverUrl}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Darstellung</Text>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          {isDark ? <Moon size={16} color={colors.textMuted} /> : <Sun size={16} color={colors.warning} />}
          <View style={styles.rowContent}>
            <Text style={[styles.rowValue, { color: colors.text }]}>{isDark ? 'Dunkles Design' : 'Helles Design'}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggle}
            trackColor={{ false: '#ccc', true: colors.primary + '60' }}
            thumbColor={isDark ? colors.primary : '#f4f3f4'}
          />
        </View>
      </View>

      <TouchableOpacity style={[styles.disconnectButton, { backgroundColor: colors.surface, borderColor: colors.danger + '30' }]} onPress={handleDisconnect}>
        <LogOut size={18} color={colors.danger} />
        <Text style={[styles.disconnectText, { color: colors.danger }]}>Verbindung trennen</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: colors.textMuted }]}>SyntroSoft Mobile v1.5.2</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  card: {
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
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
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 12,
  },
  rowValue: {
    fontSize: 15,
    marginTop: 2,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
  },
  disconnectText: {
    fontSize: 15,
    fontWeight: '500',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: spacing.xl,
  },
})
