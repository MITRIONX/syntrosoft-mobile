import { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Search, Settings } from 'lucide-react-native'
import { getConnectionInfo, ConnectionInfo } from './src/lib/auth'
import { Kunde } from './src/lib/api'
import { ScanScreen } from './src/screens/ScanScreen'
import { KundenScreen } from './src/screens/KundenScreen'
import { KundeDetailScreen } from './src/screens/KundeDetailScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { colors } from './src/theme'

const queryClient = new QueryClient()

const Tab = createBottomTabNavigator()

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

function KundenTab() {
  const [selectedKunde, setSelectedKunde] = useState<Kunde | null>(null)

  if (selectedKunde) {
    return <KundeDetailScreen kunde={selectedKunde} onBack={() => setSelectedKunde(null)} />
  }

  return <KundenScreen onSelectKunde={setSelectedKunde} />
}

function SettingsTab({ connection, onDisconnect }: { connection: ConnectionInfo; onDisconnect: () => void }) {
  return <SettingsScreen connection={connection} onDisconnect={onDisconnect} />
}

export default function App() {
  const [connection, setConnection] = useState<ConnectionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getConnectionInfo().then((info) => {
      setConnection(info)
      setLoading(false)
    })
  }, [])

  if (loading) return null

  if (!connection) {
    return (
      <>
        <StatusBar style="light" />
        <ScanScreen onPaired={async () => {
          const info = await getConnectionInfo()
          setConnection(info)
        }} />
      </>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer theme={DarkTheme}>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: 85,
              paddingTop: 8,
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarLabelStyle: {
              fontSize: 11,
              marginTop: 4,
            },
          }}
        >
          <Tab.Screen
            name="Kunden"
            options={{
              tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
            }}
          >
            {() => <KundenTab />}
          </Tab.Screen>
          <Tab.Screen
            name="Einstellungen"
            options={{
              tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
            }}
          >
            {() => <SettingsTab connection={connection} onDisconnect={() => setConnection(null)} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  )
}
