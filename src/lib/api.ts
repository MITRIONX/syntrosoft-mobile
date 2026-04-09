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

  async searchAuftraege(search: string, limit = 20, offset = 0): Promise<{ success: boolean; data: Auftrag[]; total: number }> {
    return mobileFetch('/auftraege', { search, limit: String(limit), offset: String(offset) })
  },

  async getAuftrag(id: number): Promise<{ success: boolean; data: AuftragDetail }> {
    return mobileFetch(`/auftraege/${id}`)
  },

  async getAuftragRelated(id: number): Promise<{ success: boolean; data: AuftragRelated }> {
    return mobileFetch(`/auftraege/${id}/related`)
  },
}

export interface Auftrag {
  id: number
  order_number: string
  customer_number: string | null
  customer_display_name: string | null
  order_date: string
  status: string
  is_cancelled: boolean
  total_net: number
  total_gross: number
  currency: string
  items_count: number
  billing_company: string | null
  billing_first_name: string | null
  billing_last_name: string | null
  billing_city: string | null
  shipping_company: string | null
  shipping_city: string | null
  payment_method: string | null
}

export interface AuftragDetail extends Auftrag {
  external_order_number: string | null
  customer_group_name: string | null
  subtotal_net: number
  subtotal_gross: number
  shipping_cost: number
  tax_amount: number
  billing_street: string | null
  billing_postal_code: string | null
  billing_country: string | null
  billing_email: string | null
  billing_phone: string | null
  shipping_first_name: string | null
  shipping_last_name: string | null
  shipping_street: string | null
  shipping_postal_code: string | null
  shipping_country: string | null
  notes: string | null
  items: AuftragItem[]
}

export interface AuftragRelated {
  purchaseOrders: any[]
  shippingLabels: any[]
  trackingData: any[]
  eingangsbelege: any[]
  shoppingListItems: any[]
}

export interface AuftragItem {
  id: number
  position_number: number
  article_number: string | null
  article_name: string | null
  quantity: number
  unit: string
  unit_price_net: number
  unit_price_gross: number
  total_net: number
  total_gross: number
}
