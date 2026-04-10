import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, Modal, ActivityIndicator, ScrollView } from 'react-native'
import { LogOut, Smartphone, Server, User, Sun, Moon, Printer } from 'lucide-react-native'
import { ConnectionInfo, clearConnectionInfo } from '../lib/auth'
import { useTheme } from '../theme'
import { spacing } from '../theme'
import { discoverPrinters, loadAssignments, saveAssignment, removeAssignment, NetworkPrinter, PrinterAssignment } from '../lib/printer'

interface SettingsScreenProps {
  connection: ConnectionInfo
  onDisconnect: () => void
}

const PRINTER_CONTEXTS = [
  { key: 'doctype:lieferschein', label: 'Lieferschein' },
  { key: 'doctype:paketschein', label: 'Paketschein' },
  { key: 'carrier:dhl', label: 'DHL Labels' },
  { key: 'carrier:dpd', label: 'DPD Labels' },
]

export function SettingsScreen({ connection, onDisconnect }: SettingsScreenProps) {
  const { mode, colors, toggle } = useTheme()
  const isDark = mode === 'dark'

  const [printerAssignments, setPrinterAssignments] = useState<PrinterAssignment[]>([])
  const [discoveredPrinters, setDiscoveredPrinters] = useState<NetworkPrinter[]>([])
  const [scanning, setScanning] = useState(false)
  const [assignContext, setAssignContext] = useState<string | null>(null)

  useEffect(() => { loadAssignments().then(setPrinterAssignments) }, [])

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

  const handleScanPrinters = async () => {
    setScanning(true)
    setDiscoveredPrinters([])
    try {
      const found = await discoverPrinters(5000)
      setDiscoveredPrinters(found)
      if (found.length === 0) {
        Alert.alert('Keine Drucker gefunden', 'Es wurden keine Netzwerkdrucker gefunden. Stellen Sie sicher, dass die Drucker eingeschaltet und im gleichen Netzwerk sind.')
      }
    } finally {
      setScanning(false)
    }
  }

  const handleAssignPrinter = async (printer: NetworkPrinter) => {
    if (!assignContext) return
    await saveAssignment(assignContext, printer)
    const updated = await loadAssignments()
    setPrinterAssignments(updated)
    setAssignContext(null)
  }

  const handleRemoveAssignment = (context: string) => {
    Alert.alert(
      'Zuweisung entfernen',
      'Druckerzuweisung entfernen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            await removeAssignment(context)
            const updated = await loadAssignments()
            setPrinterAssignments(updated)
          },
        },
      ]
    )
  }

  const getAssignedPrinter = (context: string): NetworkPrinter | undefined => {
    return printerAssignments.find(a => a.context === context)?.printer
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
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

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Drucker</Text>

        <TouchableOpacity
          style={[styles.scanButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
          onPress={handleScanPrinters}
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Printer size={16} color={colors.primary} />
          )}
          <Text style={[styles.scanButtonText, { color: colors.primary }]}>
            {scanning ? 'Suche laeuft...' : 'Drucker suchen'}
          </Text>
        </TouchableOpacity>

        {PRINTER_CONTEXTS.map((ctx, index) => {
          const assigned = getAssignedPrinter(ctx.key)
          const isLast = index === PRINTER_CONTEXTS.length - 1
          return (
            <TouchableOpacity
              key={ctx.key}
              style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: isLast ? 0 : 1 }]}
              onPress={() => setAssignContext(ctx.key)}
              onLongPress={() => assigned && handleRemoveAssignment(ctx.key)}
            >
              <Printer size={16} color={assigned ? colors.primary : colors.textMuted} />
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{ctx.label}</Text>
                <Text style={[styles.rowValue, { color: assigned ? colors.text : colors.textMuted }]}>
                  {assigned ? assigned.name : 'Nicht zugewiesen'}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <TouchableOpacity style={[styles.disconnectButton, { backgroundColor: colors.surface, borderColor: colors.danger + '30' }]} onPress={handleDisconnect}>
        <LogOut size={18} color={colors.danger} />
        <Text style={[styles.disconnectText, { color: colors.danger }]}>Verbindung trennen</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: colors.textMuted }]}>SyntroSoft Mobile v1.5.2</Text>

      {/* Printer selection modal */}
      <Modal
        visible={assignContext !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignContext(null)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAssignContext(null)}>
          <View style={[styles.printerModal, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.printerModalTitle, { color: colors.text }]}>Drucker auswaehlen</Text>
            <Text style={[styles.printerModalSubtitle, { color: colors.textMuted }]}>
              {PRINTER_CONTEXTS.find(c => c.key === assignContext)?.label ?? ''}
            </Text>

            {discoveredPrinters.length === 0 ? (
              <Text style={[styles.printerNone, { color: colors.textMuted }]}>
                Keine Drucker gefunden. Zuerst "Drucker suchen" tippen.
              </Text>
            ) : (
              discoveredPrinters.map((printer, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.printerOption, { borderColor: colors.border }]}
                  onPress={() => handleAssignPrinter(printer)}
                >
                  <Printer size={16} color={colors.primary} />
                  <View style={styles.rowContent}>
                    <Text style={[styles.printerName, { color: colors.text }]}>{printer.name}</Text>
                    <Text style={[styles.printerHost, { color: colors.textMuted }]}>{printer.host}:{printer.port}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={() => setAssignContext(null)}>
              <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
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
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  printerModal: {
    width: '100%',
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    gap: 4,
  },
  printerModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  printerModalSubtitle: {
    fontSize: 13,
    marginBottom: spacing.md,
  },
  printerNone: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  printerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  printerName: {
    fontSize: 15,
    fontWeight: '500',
  },
  printerHost: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: 1,
  },
  modalCancelText: {
    fontSize: 15,
  },
})
