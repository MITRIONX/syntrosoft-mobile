import 'react-native-gesture-handler'
import { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createDrawerNavigator, DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Users, Settings, Menu } from 'lucide-react-native'
import { getConnectionInfo, ConnectionInfo } from './src/lib/auth'
import { Kunde } from './src/lib/api'
import { ScanScreen } from './src/screens/ScanScreen'
import { KundenScreen } from './src/screens/KundenScreen'
import { KundeDetailScreen } from './src/screens/KundeDetailScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { colors } from './src/theme'

const queryClient = new QueryClient()
const Drawer = createDrawerNavigator()

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
}

const MENU_ITEMS = [
  { name: 'Kunden', icon: Users, label: 'Kunden' },
  { name: 'Einstellungen', icon: Settings, label: 'Einstellungen' },
]

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets()
  const currentRoute = props.state.routes[props.state.index].name

  return (
    <DrawerContentScrollView
      {...props}
      style={[styles.drawer, { paddingTop: insets.top }]}
      contentContainerStyle={styles.drawerContent}
    >
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>SyntroSoft</Text>
        <Text style={styles.drawerSubtitle}>Mobile</Text>
      </View>

      <View style={styles.drawerMenu}>
        {MENU_ITEMS.map((item) => {
          const isActive = currentRoute === item.name
          const Icon = item.icon
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.drawerItem, isActive && styles.drawerItemActive]}
              onPress={() => props.navigation.navigate(item.name)}
              activeOpacity={0.7}
            >
              <Icon size={20} color={isActive ? colors.primary : colors.textSecondary} />
              <Text style={[styles.drawerItemText, isActive && styles.drawerItemTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </DrawerContentScrollView>
  )
}

function ScreenHeader({ title, navigation }: { title: string; navigation: any }) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.burgerButton}>
        <Menu size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  )
}

function KundenPage({ navigation }: any) {
  const [selectedKunde, setSelectedKunde] = useState<Kunde | null>(null)

  if (selectedKunde) {
    return <KundeDetailScreen kunde={selectedKunde} onBack={() => setSelectedKunde(null)} />
  }

  return (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Kunden" navigation={navigation} />
      <KundenScreen onSelectKunde={setSelectedKunde} />
    </View>
  )
}

// Connection wird als globale Variable gehalten (von App gesetzt)
let _connection: ConnectionInfo | null = null
let _onDisconnect: (() => void) | null = null

function SettingsPage({ navigation }: any) {
  return (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Einstellungen" navigation={navigation} />
      {_connection && (
        <SettingsScreen connection={_connection} onDisconnect={() => _onDisconnect?.()} />
      )}
    </View>
  )
}

export default function App() {
  const [connection, setConnection] = useState<ConnectionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  _connection = connection
  _onDisconnect = () => setConnection(null)

  useEffect(() => {
    getConnectionInfo().then((info) => {
      setConnection(info)
      setLoading(false)
    })
  }, [])

  if (loading) return null

  if (!connection) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ScanScreen onPaired={async () => {
          const info = await getConnectionInfo()
          setConnection(info)
        }} />
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer theme={DarkTheme}>
          <StatusBar style="light" />
          <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
              headerShown: false,
              drawerStyle: {
                backgroundColor: colors.surface,
                width: 260,
              },
            }}
          >
            <Drawer.Screen name="Kunden" component={KundenPage} />
            <Drawer.Screen name="Einstellungen" component={SettingsPage} />
          </Drawer.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  burgerButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  drawer: {
    backgroundColor: colors.surface,
  },
  drawerContent: {
    flex: 1,
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  drawerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  drawerMenu: {
    paddingHorizontal: 12,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  drawerItemActive: {
    backgroundColor: colors.primary + '15',
  },
  drawerItemText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  drawerItemTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
})
