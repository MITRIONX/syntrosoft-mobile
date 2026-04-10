import 'react-native-gesture-handler'
import { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createDrawerNavigator, DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Users, Settings, Menu, ShoppingCart, MessageSquare, Phone, Truck, ShoppingBag, ChevronDown, ChevronRight, ClipboardList, Package, FileText, Receipt } from 'lucide-react-native'
import * as SecureStore from 'expo-secure-store'
import { getConnectionInfo, ConnectionInfo } from './src/lib/auth'
import { checkForUpdate } from './src/lib/updater'
import { Kunde, Auftrag, Ticket, Quote, Invoice } from './src/lib/api'
import { ScanScreen } from './src/screens/ScanScreen'
import { KundenScreen } from './src/screens/KundenScreen'
import { KundeDetailScreen } from './src/screens/KundeDetailScreen'
import { AuftraegeScreen } from './src/screens/AuftraegeScreen'
import { AuftragDetailScreen } from './src/screens/AuftragDetailScreen'
import { TicketsScreen } from './src/screens/TicketsScreen'
import { TicketDetailScreen } from './src/screens/TicketDetailScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { TelefonScreen } from './src/screens/TelefonScreen'
import { SendungsverfolgungScreen } from './src/screens/SendungsverfolgungScreen'
import { EinkaufslisteScreen } from './src/screens/EinkaufslisteScreen'
import { BestellungenScreen } from './src/screens/BestellungenScreen'
import { AngeboteScreen } from './src/screens/AngeboteScreen'
import { RechnungenScreen } from './src/screens/RechnungenScreen'
import { colors, darkColors, lightColors, setThemeColors, ThemeContext, ThemeMode } from './src/theme'

const queryClient = new QueryClient()
const Drawer = createDrawerNavigator()

function getNavTheme(isDark: boolean) {
  const c = isDark ? darkColors : lightColors
  return {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: c.primary,
      background: c.background,
      card: c.surface,
      text: c.text,
      border: c.border,
    },
  }
}

type MenuItem = {
  name: string; icon: any; label: string;
  children?: { name: string; icon: any; label: string }[]
}

const MENU_ITEMS: MenuItem[] = [
  { name: 'Kunden', icon: Users, label: 'Kunden' },
  { name: 'Einkauf', icon: ShoppingBag, label: 'Einkauf', children: [
    { name: 'Einkaufsliste', icon: ClipboardList, label: 'Einkaufsliste' },
    { name: 'Bestellungen', icon: Package, label: 'Bestellungen' },
  ]},
  { name: 'Verkauf', icon: ShoppingCart, label: 'Verkauf', children: [
    { name: 'Auftraege', icon: ShoppingCart, label: 'Aufträge' },
    { name: 'Angebote', icon: FileText, label: 'Angebote' },
    { name: 'Rechnungen', icon: Receipt, label: 'Rechnungen' },
  ]},
  { name: 'Versand', icon: Truck, label: 'Versand', children: [
    { name: 'Sendungsverfolgung', icon: Truck, label: 'Sendungsverfolgung' },
  ]},
  { name: 'Tickets', icon: MessageSquare, label: 'Tickets' },
  { name: 'Telefon', icon: Phone, label: 'Telefon' },
  { name: 'Einstellungen', icon: Settings, label: 'Einstellungen' },
]

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const styles = createStyles()
  const insets = useSafeAreaInsets()
  const currentRoute = props.state.routes[props.state.index].name
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpand = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const renderItem = (item: MenuItem, isChild = false) => {
    if (item.children) {
      const isOpen = expanded[item.name]
      const hasActiveChild = item.children.some(c => c.name === currentRoute)
      const Icon = item.icon
      return (
        <View key={item.name}>
          <TouchableOpacity
            style={[styles.drawerItem, hasActiveChild && styles.drawerItemActive]}
            onPress={() => toggleExpand(item.name)}
            activeOpacity={0.7}
          >
            <Icon size={20} color={hasActiveChild ? colors.primary : colors.textSecondary} />
            <Text style={[styles.drawerItemText, hasActiveChild && styles.drawerItemTextActive, { flex: 1 }]}>
              {item.label}
            </Text>
            {isOpen
              ? <ChevronDown size={16} color={colors.textMuted} />
              : <ChevronRight size={16} color={colors.textMuted} />
            }
          </TouchableOpacity>
          {isOpen && item.children.map(child => renderItem(child, true))}
        </View>
      )
    }

    const isActive = currentRoute === item.name
    const Icon = item.icon
    return (
      <TouchableOpacity
        key={item.name}
        style={[styles.drawerItem, isActive && styles.drawerItemActive, isChild && styles.drawerSubItem]}
        onPress={() => props.navigation.navigate(item.name)}
        activeOpacity={0.7}
      >
        <Icon size={isChild ? 16 : 20} color={isActive ? colors.primary : colors.textSecondary} />
        <Text style={[styles.drawerItemText, isActive && styles.drawerItemTextActive, isChild && styles.drawerSubItemText]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    )
  }

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
        {MENU_ITEMS.map(item => renderItem(item))}
      </View>
    </DrawerContentScrollView>
  )
}

function ScreenHeader({ title, navigation }: { title: string; navigation: any }) {
  const styles = createStyles()
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
  const styles = createStyles()
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

function AuftraegePage({ navigation }: any) {
  const styles = createStyles()
  const [selectedAuftrag, setSelectedAuftrag] = useState<Auftrag | null>(null)

  if (selectedAuftrag) {
    return <AuftragDetailScreen auftrag={selectedAuftrag} onBack={() => setSelectedAuftrag(null)} />
  }

  return (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Aufträge" navigation={navigation} />
      <AuftraegeScreen onSelectAuftrag={setSelectedAuftrag} />
    </View>
  )
}


function TicketsPage({ navigation }: any) {
  const styles = createStyles()
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  if (selectedTicket) {
    return <TicketDetailScreen ticket={selectedTicket} onBack={() => setSelectedTicket(null)} />
  }

  return (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Tickets" navigation={navigation} />
      <TicketsScreen onSelectTicket={setSelectedTicket} />
    </View>
  )
}

function TelefonPage({ navigation }: any) {
  const styles = createStyles()
  return (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Telefon" navigation={navigation} />
      <TelefonScreen />
    </View>
  )
}

function VersandPage({ navigation }: any) {
  const styles = createStyles()
  return (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Sendungsverfolgung" navigation={navigation} />
      <SendungsverfolgungScreen />
    </View>
  )
}

function EinkaufslistePage({ navigation }: any) {
  const styles = createStyles()
  return (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Einkaufsliste" navigation={navigation} />
      <EinkaufslisteScreen />
    </View>
  )
}

function AngebotePage({ navigation }: any) {
  const styles = createStyles()
  return (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Angebote" navigation={navigation} />
      <AngeboteScreen />
    </View>
  )
}

function RechnungenPage({ navigation }: any) {
  const styles = createStyles()
  return (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Rechnungen" navigation={navigation} />
      <RechnungenScreen />
    </View>
  )
}

function BestellungenPage({ navigation }: any) {
  const styles = createStyles()
  return (
    <View style={styles.screenContainer}>
      <ScreenHeader title="Bestellungen" navigation={navigation} />
      <BestellungenScreen />
    </View>
  )
}

// Connection wird als globale Variable gehalten (von App gesetzt)
let _connection: ConnectionInfo | null = null
let _onDisconnect: (() => void) | null = null

function SettingsPage({ navigation }: any) {
  const styles = createStyles()
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
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark')

  _connection = connection
  _onDisconnect = () => setConnection(null)

  const toggleTheme = () => {
    const newMode = themeMode === 'dark' ? 'light' : 'dark'
    setThemeColors(newMode === 'dark')
    setThemeMode(newMode)
    SecureStore.setItemAsync('theme', newMode)
  }

  useEffect(() => {
    Promise.all([
      getConnectionInfo(),
      SecureStore.getItemAsync('theme'),
    ]).then(([info, savedTheme]) => {
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeMode(savedTheme)
        setThemeColors(savedTheme === 'dark')
      }
      setConnection(info)
      setLoading(false)
    })
    checkForUpdate()
  }, [])

  if (loading) return null

  const isDark = themeMode === 'dark'
  const themeColors = isDark ? darkColors : lightColors
  const themeCtx = { mode: themeMode, colors: themeColors, toggle: toggleTheme }

  if (!connection) {
    return (
      <ThemeContext.Provider value={themeCtx}>
        <SafeAreaProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <ScanScreen onPaired={async () => {
            const info = await getConnectionInfo()
            setConnection(info)
          }} />
        </SafeAreaProvider>
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={themeCtx}>
      <SafeAreaProvider key={themeMode}>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer theme={getNavTheme(isDark)}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Drawer.Navigator
              drawerContent={(props) => <CustomDrawerContent {...props} />}
              screenOptions={{
                headerShown: false,
                drawerStyle: {
                  backgroundColor: themeColors.surface,
                  width: 260,
                },
              }}
            >
              <Drawer.Screen name="Kunden" component={KundenPage} />
              <Drawer.Screen name="Auftraege" component={AuftraegePage} />
              <Drawer.Screen name="Angebote" component={AngebotePage} />
              <Drawer.Screen name="Rechnungen" component={RechnungenPage} />
              <Drawer.Screen name="Tickets" component={TicketsPage} />
              <Drawer.Screen name="Telefon" component={TelefonPage} />
              <Drawer.Screen name="Sendungsverfolgung" component={VersandPage} />
              <Drawer.Screen name="Einkaufsliste" component={EinkaufslistePage} />
              <Drawer.Screen name="Bestellungen" component={BestellungenPage} />
              <Drawer.Screen name="Einstellungen" component={SettingsPage} />
            </Drawer.Navigator>
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ThemeContext.Provider>
  )
}

function createStyles() { return StyleSheet.create({
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
  drawerSubItem: {
    paddingLeft: 48,
    paddingVertical: 8,
  },
  drawerSubItemText: {
    fontSize: 13,
  },
}) }
