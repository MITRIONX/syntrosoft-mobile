import { Linking } from 'react-native'
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

async function mobilePut<T>(path: string, body: Record<string, any>): Promise<T> {
  const conn = await getConnectionInfo()
  if (!conn) throw new Error('Nicht verbunden')

  const res = await fetch(`${conn.serverUrl}/api/mobile${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${conn.deviceToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

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

  async searchTickets(search: string, status: 'open' | 'final' = 'open', limit = 30, page = 1): Promise<{ success: boolean; tickets: Ticket[]; data?: Ticket[]; pagination?: { total: number; page: number; pages: number } }> {
    return mobileFetch('/tickets', { search, is_final: status === 'final' ? 'final' : 'open', limit: String(limit), page: String(page) })
  },

  async getTicket(id: number): Promise<{ success: boolean; data: TicketDetail }> {
    const res = await mobileFetch<{ success: boolean; ticket: Ticket; messages: TicketMessage[] }>(`/tickets/${id}`)
    return { success: res.success, data: { ...res.ticket, ticket_messages: res.messages || [] } as TicketDetail }
  },

  async searchShoppingList(params: { status?: string; search?: string } = {}): Promise<{ success: boolean; data: ShoppingListItem[]; stats?: { total: number; offen: number; bestellt: number; erledigt: number } }> {
    const query: Record<string, string> = {}
    if (params.status) query.status = params.status
    if (params.search) query.search = params.search
    return mobileFetch('/versand/shopping-list', query)
  },

  async getShoppingListPreview(): Promise<{ success: boolean; data: SupplierGroup[] }> {
    const conn = await getConnectionInfo()
    if (!conn) throw new Error('Nicht verbunden')
    const res = await fetch(`${conn.serverUrl}/api/mobile/versand/shopping-list/preview`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${conn.deviceToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) throw new Error(`Fehler: ${res.status}`)
    return res.json()
  },

  async searchPurchaseOrders(params: { search?: string; status?: string; limit?: number; offset?: number } = {}): Promise<{ success: boolean; data: PurchaseOrder[]; total?: number }> {
    const query: Record<string, string> = {}
    if (params.search) query.search = params.search
    if (params.status) query.status = params.status
    if (params.limit) query.limit = String(params.limit)
    if (params.offset) query.offset = String(params.offset)
    return mobileFetch('/versand/purchase-orders', query)
  },

  async getPurchaseOrder(id: number): Promise<{ success: boolean; data: PurchaseOrder }> {
    return mobileFetch(`/versand/purchase-orders/${id}`)
  },

  async getPurchaseOrderAddress(id: number): Promise<{ success: boolean; data: any }> {
    return mobileFetch(`/versand/purchase-orders/${id}/shipping-address`)
  },

  async getPurchaseOrderItems(id: number): Promise<{ success: boolean; data: PurchaseOrderItem[] }> {
    return mobileFetch(`/versand/purchase-orders/${id}/items`)
  },

  async searchQuotes(params: { search?: string; limit?: number; offset?: number } = {}): Promise<{ success: boolean; data: Quote[]; total?: number }> {
    const query: Record<string, string> = {}
    if (params.search) query.search = params.search
    if (params.limit) query.limit = String(params.limit)
    if (params.offset) query.offset = String(params.offset)
    return mobileFetch('/versand/quotes', query)
  },

  async getQuoteItems(id: number): Promise<{ success: boolean; data: QuoteItem[] }> {
    return mobileFetch(`/versand/quotes/${id}/items`)
  },

  async searchInvoices(params: { search?: string; limit?: number; offset?: number } = {}): Promise<{ success: boolean; data: Invoice[]; total?: number }> {
    const query: Record<string, string> = {}
    if (params.search) query.search = params.search
    if (params.limit) query.limit = String(params.limit)
    if (params.offset) query.offset = String(params.offset)
    return mobileFetch('/versand/rechnungen', query)
  },

  async getInvoiceItems(id: number): Promise<{ success: boolean; data: InvoiceItem[] }> {
    return mobileFetch(`/versand/rechnungen/${id}/items`)
  },

  async searchTracking(params: { search?: string; status?: string; limit?: number; offset?: number } = {}): Promise<{ success: boolean; data: TrackingEntry[]; total?: number }> {
    const query: Record<string, string> = {}
    if (params.search) query.search = params.search
    if (params.status) query.status = params.status
    if (params.limit) query.limit = String(params.limit)
    if (params.offset) query.offset = String(params.offset)
    return mobileFetch('/versand/tracking', query)
  },

  async searchCalls(params: { page?: number; limit?: number; status?: string; search?: string } = {}): Promise<{ success: boolean; data: CallLogEntry[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    const query: Record<string, string> = {}
    if (params.page) query.page = String(params.page)
    if (params.limit) query.limit = String(params.limit)
    if (params.status) query.status = params.status
    if (params.search) query.search = params.search
    return mobileFetch('/telefonie/calls', query)
  },

  async linkCallToCustomer(callId: number, customerId: number): Promise<{ success: boolean }> {
    return mobilePut(`/telefonie/calls/${callId}/link`, { customer_id: customerId })
  },

  async createCustomerFromCall(callId: number, data: { company_name?: string; first_name?: string; last_name?: string; phone: string; email?: string }): Promise<{ success: boolean; data?: any }> {
    const conn = await getConnectionInfo()
    if (!conn) throw new Error('Nicht verbunden')
    const res = await fetch(`${conn.serverUrl}/api/mobile/telefonie/create-customer`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${conn.deviceToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId, ...data }),
    })
    if (!res.ok) throw new Error(`Fehler: ${res.status}`)
    return res.json()
  },

  async getTicketStatuses(): Promise<{ success: boolean; statuses: TicketStatus[] }> {
    return mobileFetch('/tickets/config/statuses')
  },

  async getTicketAgents(): Promise<{ success: boolean; agents: TicketAgent[] }> {
    return mobileFetch('/tickets/config/agents')
  },

  async updateTicket(id: number, updates: { status_id?: number; assigned_user_id?: number | null }): Promise<{ success: boolean }> {
    return mobilePut(`/tickets/${id}`, updates)
  },

  async replyToTicket(ticketId: number, body: string, senderName?: string): Promise<{ success: boolean }> {
    const conn = await getConnectionInfo()
    if (!conn) throw new Error('Nicht verbunden')
    const res = await fetch(`${conn.serverUrl}/api/mobile/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conn.deviceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body, sender_type: 'agent', sender_name: senderName || 'Mobile App' }),
    })
    if (!res.ok) throw new Error(`Fehler: ${res.status}`)
    return res.json()
  },

  async getTicketAttachments(ticketId: number): Promise<{ success: boolean; attachments: TicketAttachment[] }> {
    return mobileFetch(`/tickets/${ticketId}/attachments`)
  },

  async getTicketAttachmentUrl(attachmentId: number): Promise<string> {
    const conn = await getConnectionInfo()
    if (!conn) throw new Error('Nicht verbunden')
    return `${conn.serverUrl}/api/mobile/tickets/attachment/${attachmentId}?token=${conn.deviceToken}`
  },

  /** Eingangsbeleg-PDF im Browser oeffnen */
  async openEingangsbelegPdf(belegId: number): Promise<void> {
    const conn = await getConnectionInfo()
    if (!conn) return
    Linking.openURL(`${conn.serverUrl}/api/mobile/auftraege/eingangsbeleg/${belegId}/pdf?token=${conn.deviceToken}`)
  },

  /** AB-Attachment im Browser oeffnen */
  async openAbAttachment(attachmentId: number): Promise<void> {
    const conn = await getConnectionInfo()
    if (!conn) return
    Linking.openURL(`${conn.serverUrl}/api/mobile/auftraege/attachment/${attachmentId}?token=${conn.deviceToken}`)
  },
}

export interface Quote {
  id: number
  quote_number: string
  customer_display_name: string | null
  quote_date: string | null
  valid_until: string | null
  status: string
  total_net: number
  total_gross: number
  items_count: number
  is_cancelled: boolean
  created_at: string
}

export interface QuoteItem {
  id: number
  position_number: number
  article_number: string | null
  article_name: string | null
  quantity: number
  unit: string
  unit_price_net: number
  total_net: number
  total_gross: number
}

export interface Invoice {
  id: number
  invoice_number: string
  customer_name: string | null
  invoice_date: string | null
  due_date: string | null
  total_net: number
  total_gross: number
  status: string
  payment_status: string | null
  outstanding_amount: number | null
  is_cancelled: boolean
  items_count: number
}

export interface InvoiceItem {
  id: number
  position_number: number
  article_number: string | null
  article_name: string | null
  quantity: number
  unit: string
  unit_price_net: number
  total_net: number
  total_gross: number
  tax_rate: number
}

export interface Auftrag {
  id: number
  order_number: string
  external_order_number: string | null
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

export interface Ticket {
  id: number
  ticket_number: string
  subject: string
  status_name: string
  status_color: string
  priority_name: string | null
  priority_color: string | null
  group_name: string | null
  customer_display_name: string | null
  supplier_display_name: string | null
  customer_email: string | null
  message_count: number
  created_at: string
  updated_at: string
}

export interface TicketMessage {
  id: number
  sender_type: 'customer' | 'agent' | 'system'
  sender_name: string | null
  sender_email: string | null
  body: string
  body_html: string | null
  is_internal_note: boolean
  has_attachments: boolean
  created_at: string
}

export interface TicketStatus {
  id: number
  name: string
  color: string
  is_final: boolean
  is_active: boolean
}

export interface TicketAgent {
  id: number
  name: string
  email: string
  is_active: boolean
}

export interface TicketAttachment {
  id: number
  ticket_id: number
  message_id: number | null
  filename: string
  mime_type: string | null
  file_size: number | null
  is_inline: boolean
  created_at: string
}

export interface TicketDetail extends Ticket {
  ticket_messages: TicketMessage[]
}

export interface SupplierGroup {
  supplier_id: number | null
  supplier_name: string
  items: any[]
  total_ek_netto: number
  total_quantity: number
  item_count: number
  mindestbestellwert: number | null
  versandkostenfrei_ab: number | null
  versandkosten: number | null
  below_minimum: boolean
  below_free_shipping: boolean
  shipping_cost: number
}

export interface ShoppingListItem {
  id: number
  artikel_nummer: string | null
  artikel_name: string | null
  menge: number
  einheit: string
  order_number: string | null
  supplier_id: number | null
  supplier_name: string | null
  status: 'offen' | 'bestellt' | 'erledigt'
  notizen: string | null
  created_at: string
}

export interface PurchaseOrder {
  id: number
  order_number: string
  supplier_name: string | null
  order_date: string | null
  status_text: string | null
  total_net: number
  total_gross: number
  items_count: number
  qty_total: number | null
  qty_delivered: number | null
  reference_order_number: string | null
  is_dropshipping: number
  warehouse_name: string | null
  created_at: string
}

export interface PurchaseOrderItem {
  id: number
  article_number: string | null
  article_name: string | null
  supplier_article_number: string | null
  quantity: number
  quantity_delivered: number | null
  unit_price_net: number
  total_net: number
  tax_rate: number
  item_type: string
}

export interface TrackingEntry {
  id: number
  trackingnummer: string
  dienstleister: string
  supplier_id: number | null
  supplier_name: string | null
  delivery_status: string
  status_label: string | null
  reference: string | null
  matched_order_number: string | null
  lieferanten_bestellnr: string | null
  lieferschein_nummer: string | null
  lieferant: string | null
  tracking_url: string | null
  delivered_at: string | null
  created_at: string
}

export interface CallLogEntry {
  id: number
  call_id: string | null
  direction: 'in' | 'out'
  from_number: string
  to_number: string
  caller_name: string | null
  contact_name: string | null
  status: 'ringing' | 'answered' | 'missed' | 'busy' | 'completed'
  duration_seconds: number | null
  started_at: string
  answered_at: string | null
  ended_at: string | null
  customer_id: number | null
  supplier_id: number | null
  user_name: string | null
  notes: string | null
  created_at: string
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
