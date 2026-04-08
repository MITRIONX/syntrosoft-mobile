import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { BarCodeScanner } from 'expo-barcode-scanner'
import { pairDevice } from '../lib/auth'
import { colors } from '../theme'

interface ScanScreenProps {
  onPaired: () => void
}

export function ScanScreen({ onPaired }: ScanScreenProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const [pairing, setPairing] = useState(false)

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted')
    })
  }, [])

  const handleBarCodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || pairing) return
    setScanned(true)
    setPairing(true)

    try {
      const parsed = JSON.parse(data)
      if (!parsed.url || !parsed.pairingToken) {
        throw new Error('Ungueltiger QR-Code')
      }
      await pairDevice(parsed.url, parsed.pairingToken)
      onPaired()
    } catch (err: any) {
      Alert.alert('Fehler', err.message || 'Pairing fehlgeschlagen', [
        { text: 'Nochmal', onPress: () => { setScanned(false); setPairing(false) } },
      ])
    }
  }

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.text}>Kamera-Zugriff wird angefragt...</Text>
      </View>
    )
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Kamera-Zugriff benoetigt</Text>
        <Text style={styles.text}>
          Bitte erlauben Sie den Kamera-Zugriff in den Geraete-Einstellungen.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SyntroSoft</Text>
        <Text style={styles.subtitle}>QR-Code scannen um zu verbinden</Text>
      </View>

      <View style={styles.scannerContainer}>
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
          barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
        />
        {/* Scan overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
        </View>
      </View>

      {pairing && (
        <View style={styles.pairingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.pairingText}>Wird gekoppelt...</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Oeffnen Sie SyntroSoft am PC unter{'\n'}
          Einstellungen → SyntroSoft App → Geraet koppeln
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 40,
  },
  scannerContainer: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  pairingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15,17,23,0.9)',
  },
  pairingText: {
    color: colors.text,
    fontSize: 16,
    marginTop: 16,
  },
  footer: {
    padding: 30,
    alignItems: 'center',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
})
