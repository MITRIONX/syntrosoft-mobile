import { getConnectionInfo } from './auth'

async function mobileFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const conn = await getConnectionInfo()
  if (!conn) throw new Error('Nicht verbunden')

  const query = params ? '?' + new URLSearchParams(params).toString() : ''
  const res = await fetch(`${conn.serverUrl}/api/mobile${path}${query}`, {
    headers: {
      'Authorization': `Bearer ${conn.deviceToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (res.status === 401) throw new Error('Token ungueltig - bitte neu koppeln')
  if (res.status === 403) throw new Error('Mobile-Modul nicht freigeschaltet')
  if (!res.ok) throw new Error(`Fehler: ${res.status}`)

  return res.json()
}

export interface Kunde {
  id: number
  customer_number: string
  company_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  street: string | null
  house_number: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  is_active: boolean
}

export interface KundenResponse {
  success: boolean
  data: Kunde[]
  total?: number
}

export const api = {
  async searchKunden(search: string, limit = 20, offset = 0): Promise<KundenResponse> {
    return mobileFetch('/kunden', { search, limit: String(limit), offset: String(offset) })
  },

  async getKunde(id: number): Promise<{ success: boolean; data: Kunde }> {
    return mobileFetch(`/kunden/${id}`)
  },

  async getKundeAuftraege(id: number, limit = 20, offset = 0): Promise<any> {
    return mobileFetch(`/kunden/${id}/auftraege`, { limit: String(limit), offset: String(offset) })
  },

  async getKundeTickets(id: number): Promise<any> {
    return mobileFetch(`/kunden/${id}/tickets`)
  },
}
