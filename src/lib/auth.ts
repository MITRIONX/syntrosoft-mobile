import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import * as Device from 'expo-device'

// Legacy keys (single account - fuer Migration)
const DEVICE_TOKEN_KEY = 'syntrosoft_device_token'
const SERVER_URL_KEY = 'syntrosoft_server_url'
const TENANT_NAME_KEY = 'syntrosoft_tenant_name'
const USER_NAME_KEY = 'syntrosoft_user_name'

// Multi-Account keys
const ACCOUNTS_KEY = 'syntrosoft_accounts'
const ACTIVE_ACCOUNT_KEY = 'syntrosoft_active_account'

export interface ConnectionInfo {
  deviceToken: string
  serverUrl: string
  tenantName: string
  userName: string
}

// --- Multi-Account ---

export async function getAllAccounts(): Promise<ConnectionInfo[]> {
  const json = await SecureStore.getItemAsync(ACCOUNTS_KEY)
  if (json) return JSON.parse(json)

  // Migration: alten Single-Account uebernehmen
  const legacy = await getLegacyConnection()
  if (legacy) {
    await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify([legacy]))
    await SecureStore.setItemAsync(ACTIVE_ACCOUNT_KEY, '0')
    return [legacy]
  }
  return []
}

async function getLegacyConnection(): Promise<ConnectionInfo | null> {
  const deviceToken = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY)
  const serverUrl = await SecureStore.getItemAsync(SERVER_URL_KEY)
  if (!deviceToken || !serverUrl) return null
  const tenantName = await SecureStore.getItemAsync(TENANT_NAME_KEY)
  const userName = await SecureStore.getItemAsync(USER_NAME_KEY)
  return { deviceToken, serverUrl, tenantName: tenantName || '', userName: userName || '' }
}

export async function getActiveAccountIndex(): Promise<number> {
  const idx = await SecureStore.getItemAsync(ACTIVE_ACCOUNT_KEY)
  return idx ? parseInt(idx) : 0
}

export async function setActiveAccount(index: number): Promise<ConnectionInfo | null> {
  const accounts = await getAllAccounts()
  if (index < 0 || index >= accounts.length) return null
  await SecureStore.setItemAsync(ACTIVE_ACCOUNT_KEY, String(index))
  // Sync legacy keys fuer bestehende API-Calls
  const info = accounts[index]
  await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, info.deviceToken)
  await SecureStore.setItemAsync(SERVER_URL_KEY, info.serverUrl)
  await SecureStore.setItemAsync(TENANT_NAME_KEY, info.tenantName)
  await SecureStore.setItemAsync(USER_NAME_KEY, info.userName)
  return info
}

export async function addAccount(info: ConnectionInfo): Promise<number> {
  const accounts = await getAllAccounts()
  // Pruefen ob Account schon existiert (gleicher Tenant)
  const existing = accounts.findIndex(a => a.tenantName === info.tenantName && a.serverUrl === info.serverUrl)
  if (existing >= 0) {
    // Aktualisieren
    accounts[existing] = info
    await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(accounts))
    return existing
  }
  accounts.push(info)
  await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(accounts))
  return accounts.length - 1
}

export async function removeAccount(index: number): Promise<void> {
  const accounts = await getAllAccounts()
  if (index < 0 || index >= accounts.length) return
  accounts.splice(index, 1)
  await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(accounts))
  // Aktiven Account anpassen
  const active = await getActiveAccountIndex()
  if (active >= accounts.length) {
    await SecureStore.setItemAsync(ACTIVE_ACCOUNT_KEY, String(Math.max(0, accounts.length - 1)))
  }
  if (accounts.length === 0) {
    await clearConnectionInfo()
  }
}

// --- Kompatibilitaet (wird von api.ts genutzt) ---

export async function getConnectionInfo(): Promise<ConnectionInfo | null> {
  const accounts = await getAllAccounts()
  if (accounts.length === 0) return null
  const idx = await getActiveAccountIndex()
  return accounts[idx] || accounts[0] || null
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
  await SecureStore.deleteItemAsync(ACCOUNTS_KEY)
  await SecureStore.deleteItemAsync(ACTIVE_ACCOUNT_KEY)
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

  // Account hinzufuegen und aktivieren
  const idx = await addAccount(info)
  await setActiveAccount(idx)
  return info
}
