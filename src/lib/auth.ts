import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import * as Device from 'expo-device'

const DEVICE_TOKEN_KEY = 'syntrosoft_device_token'
const SERVER_URL_KEY = 'syntrosoft_server_url'
const TENANT_NAME_KEY = 'syntrosoft_tenant_name'
const USER_NAME_KEY = 'syntrosoft_user_name'

export interface ConnectionInfo {
  deviceToken: string
  serverUrl: string
  tenantName: string
  userName: string
}

export async function getConnectionInfo(): Promise<ConnectionInfo | null> {
  const deviceToken = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY)
  const serverUrl = await SecureStore.getItemAsync(SERVER_URL_KEY)
  const tenantName = await SecureStore.getItemAsync(TENANT_NAME_KEY)
  const userName = await SecureStore.getItemAsync(USER_NAME_KEY)
  if (!deviceToken || !serverUrl) return null
  return { deviceToken, serverUrl, tenantName: tenantName || '', userName: userName || '' }
}

export async function saveConnectionInfo(info: ConnectionInfo): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, info.deviceToken)
  await SecureStore.setItemAsync(SERVER_URL_KEY, info.serverUrl)
  await SecureStore.setItemAsync(TENANT_NAME_KEY, info.tenantName)
  await SecureStore.setItemAsync(USER_NAME_KEY, info.userName)
}

export async function clearConnectionInfo(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY)
  await SecureStore.deleteItemAsync(SERVER_URL_KEY)
  await SecureStore.deleteItemAsync(TENANT_NAME_KEY)
  await SecureStore.deleteItemAsync(USER_NAME_KEY)
}

export async function pairDevice(serverUrl: string, pairingToken: string): Promise<ConnectionInfo> {
  const deviceName = Device.deviceName || `${Platform.OS} Geraet`
  const os = Platform.OS === 'ios' ? 'ios' : 'android'

  const res = await fetch(`${serverUrl}/api/mobile/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairingToken, deviceName, os }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || 'Pairing fehlgeschlagen')
  }

  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Pairing fehlgeschlagen')

  const info: ConnectionInfo = {
    deviceToken: data.deviceToken,
    serverUrl,
    tenantName: data.tenantName,
    userName: data.userName,
  }
  await saveConnectionInfo(info)
  return info
}
