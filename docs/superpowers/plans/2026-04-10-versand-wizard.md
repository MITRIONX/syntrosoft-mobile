# Versand-Wizard Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vollständiger Versand-Workflow auf dem Handy mit Label-Erstellung, Lieferschein-Druck und Netzwerk-Drucker-Support.

**Architecture:** Mobile App proxied alle Calls via Admin-Backend (`syntrosoft-admin-backend/src/routes/mobile-versand.ts`) zum Tenant Electron-Backend. Neue Proxy-Routen fuer Labels, Carrier, Druckvorlagen und PDF-Render. Drucken via IPP direkt vom Handy zum Netzwerkdrucker, Drucker-Discovery via mDNS/Zeroconf.

**Tech Stack:** React Native, react-native-zeroconf (mDNS), IPP ueber fetch (HTTP), Puppeteer (Backend PDF-Render), Express Proxy-Routen.

**Repos:**
- Mobile App: `D:/SYNTROSOFT/syntrosoft-mobile`
- Admin-Backend (Proxy): `D:/SYNTROSOFT/syntrosoft-admin-backend`
- Electron-Backend (Tenant): `D:/SYNTROSOFT/syntrosoft-electron-back`

---

## File Structure

### Mobile App (`syntrosoft-mobile`)

| Datei | Verantwortung |
|-------|--------------|
| `src/screens/VersandWizard.tsx` | Wizard-Container: Step-Navigation, Header, State-Management |
| `src/screens/wizard/Step1Positionen.tsx` | Positionszuweisung mit Mengenbearbeitung |
| `src/screens/wizard/Step2Pakete.tsx` | Carrier-Wahl, Label-Erstellung, Gewicht |
| `src/screens/wizard/Step3Abschluss.tsx` | Zusammenfassung, Lieferschein, Ausliefern |
| `src/lib/printer.ts` | mDNS Discovery + IPP Druck |
| `src/lib/api.ts` | Erweitern: Shipping/Label/Print API-Calls |
| `src/screens/EinstellungenScreen.tsx` | Erweitern: Drucker-Setup Sektion |
| `src/screens/AuftraegeScreen.tsx` | Anpassen: Wizard statt inline Modal |

### Admin-Backend (`syntrosoft-admin-backend`)

| Datei | Verantwortung |
|-------|--------------|
| `src/routes/mobile-versand.ts` | Erweitern: Proxy-Routen fuer Labels, Carrier, Druckvorlagen, PDF-Render |

### Electron-Backend (`syntrosoft-electron-back`)

| Datei | Verantwortung |
|-------|--------------|
| `src/routes/shipping.ts` | Bestehend - Labels, Fulfillment |
| `src/services/pdfRenderer.ts` | Neu: HTML-Template zu PDF via Puppeteer |
| `src/routes/druckvorlagen.ts` | Erweitern: Render-Endpoint |

---

## Task 1: Backend Proxy-Routen fuer Shipping

**Files:**
- Modify: `D:/SYNTROSOFT/syntrosoft-admin-backend/src/routes/mobile-versand.ts`

- [ ] **Step 1: Shipping Methods Proxy hinzufuegen**

Am Ende von `mobile-versand.ts` vor dem letzten Export einfuegen:

```typescript
// GET /api/mobile/versand/shipping/methods
mobileVersandRouter.get('/shipping/methods', async (req, res) => {
  try {
    const { tenantId, userId } = (req as any).mobileAuth
    const backendUrl = await getTenantBackendUrl(tenantId)
    if (!backendUrl) return res.status(404).json({ success: false, error: 'Backend not found' })
    const data = await proxyToBackend(backendUrl, '/api/shipping/methods', tenantId, userId)
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})
```

- [ ] **Step 2: Sender Address Proxy hinzufuegen**

```typescript
// GET /api/mobile/versand/shipping/sender-address/:carrier
mobileVersandRouter.get('/shipping/sender-address/:carrier', async (req, res) => {
  try {
    const { tenantId, userId } = (req as any).mobileAuth
    const backendUrl = await getTenantBackendUrl(tenantId)
    if (!backendUrl) return res.status(404).json({ success: false, error: 'Backend not found' })
    const data = await proxyToBackend(backendUrl, `/api/shipping/sender-address/${req.params.carrier}`, tenantId, userId)
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})
```

- [ ] **Step 3: Label Create Proxy hinzufuegen**

```typescript
// POST /api/mobile/versand/shipping/order/:orderId/labels
mobileVersandRouter.post('/shipping/order/:orderId/labels', async (req, res) => {
  try {
    const { tenantId, userId } = (req as any).mobileAuth
    const backendUrl = await getTenantBackendUrl(tenantId)
    if (!backendUrl) return res.status(404).json({ success: false, error: 'Backend not found' })
    const proxyToken = createProxyToken(tenantId, userId)
    const response = await fetch(`${backendUrl}/api/shipping/labels/create`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${proxyToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    const data = await response.json()
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})
```

- [ ] **Step 4: Label PDF Proxy hinzufuegen**

```typescript
// GET /api/mobile/versand/shipping/labels/:labelId/pdf
mobileVersandRouter.get('/shipping/labels/:labelId/pdf', async (req, res) => {
  try {
    const { tenantId, userId } = (req as any).mobileAuth
    const backendUrl = await getTenantBackendUrl(tenantId)
    if (!backendUrl) return res.status(404).json({ success: false, error: 'Backend not found' })
    const data = await proxyToBackend(backendUrl, `/api/shipping/labels/${req.params.labelId}/pdf`, tenantId, userId)
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})
```

- [ ] **Step 5: Druckvorlagen Proxy hinzufuegen**

```typescript
// GET /api/mobile/versand/druckvorlagen
mobileVersandRouter.get('/druckvorlagen', async (req, res) => {
  try {
    const { tenantId, userId } = (req as any).mobileAuth
    const backendUrl = await getTenantBackendUrl(tenantId)
    if (!backendUrl) return res.status(404).json({ success: false, error: 'Backend not found' })
    const query = req.query.type ? `type=${req.query.type}` : ''
    const data = await proxyToBackend(backendUrl, '/api/druckvorlagen', tenantId, userId, query)
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})
```

- [ ] **Step 6: Delivery Notes Proxy hinzufuegen**

```typescript
// GET /api/mobile/versand/delivery-notes/order/:orderId
mobileVersandRouter.get('/delivery-notes/order/:orderId', async (req, res) => {
  try {
    const { tenantId, userId } = (req as any).mobileAuth
    const backendUrl = await getTenantBackendUrl(tenantId)
    if (!backendUrl) return res.status(404).json({ success: false, error: 'Backend not found' })
    const data = await proxyToBackend(backendUrl, `/api/delivery-notes/order/${req.params.orderId}`, tenantId, userId)
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})
```

- [ ] **Step 7: Commit**

```bash
cd D:/SYNTROSOFT/syntrosoft-admin-backend
git add src/routes/mobile-versand.ts
git commit -m "feat: Mobile Proxy-Routen fuer Shipping Labels, Carrier, Druckvorlagen"
```

---

## Task 2: Backend PDF-Render Endpoint

**Files:**
- Create: `D:/SYNTROSOFT/syntrosoft-electron-back/src/services/pdfRenderer.ts`
- Modify: `D:/SYNTROSOFT/syntrosoft-electron-back/src/routes/druckvorlagen.ts`

- [ ] **Step 1: PDF-Renderer Service erstellen**

```typescript
// src/services/pdfRenderer.ts
import puppeteer from 'puppeteer'

let browserInstance: any = null

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
  return browserInstance
}

export async function renderHtmlToPdf(html: string, options: { width?: string; height?: string } = {}): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      width: options.width || '102mm',
      height: options.height || undefined,
      printBackground: true,
      margin: { top: '3mm', right: '3mm', bottom: '3mm', left: '3mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}
```

- [ ] **Step 2: Render-Endpoint in druckvorlagen.ts hinzufuegen**

Am Ende von `druckvorlagen.ts`:

```typescript
import { renderHtmlToPdf } from '../services/pdfRenderer.js'

// POST /api/druckvorlagen/render - Template rendern zu PDF
druckvorlagenRouter.post('/render', async (req, res) => {
  try {
    const { pool } = req as unknown as TenantRequest
    const { templateId, orderId, deliveryNoteId, paperWidth } = req.body

    if (!templateId) return res.status(400).json({ success: false, error: 'templateId erforderlich' })

    // Template laden
    const tmplResult = await pool.query('SELECT content, document_type FROM print_templates WHERE id = $1', [templateId])
    if (tmplResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Template nicht gefunden' })

    let html = tmplResult.rows[0].content

    // Variablen ersetzen - Firmendaten
    const companySettings = await pool.query('SELECT setting_key, setting_value FROM company_settings')
    const settings: Record<string, string> = {}
    for (const row of companySettings.rows) {
      settings[row.setting_key] = row.setting_value || ''
    }
    html = html.replace(/\{\{firma\.name\}\}/g, settings.company_name || '')
    html = html.replace(/\{\{firma\.strasse\}\}/g, settings.company_street || '')
    html = html.replace(/\{\{firma\.plz\}\}/g, settings.company_postal_code || '')
    html = html.replace(/\{\{firma\.ort\}\}/g, settings.company_city || '')
    html = html.replace(/\{\{firma\.telefon\}\}/g, settings.company_phone || '')
    html = html.replace(/\{\{firma\.email\}\}/g, settings.company_email || '')
    html = html.replace(/\{\{firma\.website\}\}/g, settings.company_website || '')
    html = html.replace(/\{\{firma\.ustid\}\}/g, settings.company_vat_id || '')

    // Order-Daten wenn orderId gegeben
    if (orderId) {
      const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId])
      if (orderResult.rows.length > 0) {
        const o = orderResult.rows[0]
        html = html.replace(/\{\{auftrag\.nummer\}\}/g, o.order_number || '')
        html = html.replace(/\{\{auftrag\.datum\}\}/g, o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '')
        html = html.replace(/\{\{kunde\.firma\}\}/g, o.billing_company || '')
        html = html.replace(/\{\{kunde\.name\}\}/g, [o.billing_first_name, o.billing_last_name].filter(Boolean).join(' '))
        html = html.replace(/\{\{kunde\.strasse\}\}/g, o.billing_street || '')
        html = html.replace(/\{\{kunde\.plz\}\}/g, o.billing_postal_code || '')
        html = html.replace(/\{\{kunde\.ort\}\}/g, o.billing_city || '')
        html = html.replace(/\{\{kunde\.land\}\}/g, o.billing_country || '')
        html = html.replace(/\{\{kunde\.email\}\}/g, o.billing_email || '')
        html = html.replace(/\{\{versand\.firma\}\}/g, o.shipping_company || o.billing_company || '')
        html = html.replace(/\{\{versand\.name\}\}/g, [o.shipping_first_name || o.billing_first_name, o.shipping_last_name || o.billing_last_name].filter(Boolean).join(' '))
        html = html.replace(/\{\{versand\.strasse\}\}/g, o.shipping_street || o.billing_street || '')
        html = html.replace(/\{\{versand\.plz\}\}/g, o.shipping_postal_code || o.billing_postal_code || '')
        html = html.replace(/\{\{versand\.ort\}\}/g, o.shipping_city || o.billing_city || '')
      }

      // Positionen
      const itemsResult = await pool.query(
        "SELECT * FROM order_items WHERE order_id = $1 AND item_type NOT IN ('shipping', 'surcharge', 'coupon') ORDER BY position_number",
        [orderId]
      )
      const posRows = itemsResult.rows.map((item, idx) =>
        `<tr><td>${idx + 1}</td><td>${item.article_number || ''}</td><td>${item.article_name || ''}</td><td>${item.quantity} ${item.unit || 'Stk'}</td></tr>`
      ).join('')
      html = html.replace(/\{\{positionen\}\}/g, posRows)
    }

    // Lieferschein-Daten wenn deliveryNoteId gegeben
    if (deliveryNoteId) {
      const dnResult = await pool.query('SELECT * FROM delivery_notes WHERE id = $1', [deliveryNoteId])
      if (dnResult.rows.length > 0) {
        const dn = dnResult.rows[0]
        html = html.replace(/\{\{lieferschein\.nummer\}\}/g, dn.delivery_note_number || '')
        html = html.replace(/\{\{lieferschein\.datum\}\}/g, dn.created_at ? new Date(dn.created_at).toLocaleDateString('de-DE') : '')
        html = html.replace(/\{\{lieferschein\.tracking\}\}/g, dn.tracking_number || '')
        html = html.replace(/\{\{lieferschein\.carrier\}\}/g, dn.carrier || '')
      }
      const dniResult = await pool.query('SELECT * FROM delivery_note_items WHERE delivery_note_id = $1 ORDER BY id', [deliveryNoteId])
      const dnPosRows = dniResult.rows.map((item, idx) =>
        `<tr><td>${idx + 1}</td><td>${item.article_number || ''}</td><td>${item.article_name || ''}</td><td>${item.quantity} ${item.unit || 'Stk'}</td></tr>`
      ).join('')
      html = html.replace(/\{\{lieferschein\.positionen\}\}/g, dnPosRows)
    }

    // Datum
    html = html.replace(/\{\{datum\}\}/g, new Date().toLocaleDateString('de-DE'))

    const width = paperWidth ? `${paperWidth}mm` : '102mm'
    const pdfBuffer = await renderHtmlToPdf(html, { width })
    const base64 = pdfBuffer.toString('base64')

    res.json({ success: true, pdf: base64 })
  } catch (error: any) {
    console.error('[Druckvorlagen] Render error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})
```

- [ ] **Step 3: Render-Proxy im Admin-Backend hinzufuegen**

In `mobile-versand.ts`:

```typescript
// POST /api/mobile/versand/druckvorlagen/render
mobileVersandRouter.post('/druckvorlagen/render', async (req, res) => {
  try {
    const { tenantId, userId } = (req as any).mobileAuth
    const backendUrl = await getTenantBackendUrl(tenantId)
    if (!backendUrl) return res.status(404).json({ success: false, error: 'Backend not found' })
    const proxyToken = createProxyToken(tenantId, userId)
    const response = await fetch(`${backendUrl}/api/druckvorlagen/render`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${proxyToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    const data = await response.json()
    res.json(data)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})
```

- [ ] **Step 4: Commit beide Repos**

```bash
cd D:/SYNTROSOFT/syntrosoft-electron-back
git add src/services/pdfRenderer.ts src/routes/druckvorlagen.ts
git commit -m "feat: PDF-Render Endpoint fuer Mobile Druckvorlagen"

cd D:/SYNTROSOFT/syntrosoft-admin-backend
git add src/routes/mobile-versand.ts
git commit -m "feat: Druckvorlagen-Render Proxy fuer Mobile"
```

---

## Task 3: Mobile API-Funktionen erweitern

**Files:**
- Modify: `D:/SYNTROSOFT/syntrosoft-mobile/src/lib/api.ts`

- [ ] **Step 1: mobilePost Helper hinzufuegen**

Nach der `mobilePut` Funktion:

```typescript
async function mobilePost<T>(path: string, body: Record<string, any>): Promise<T> {
  const conn = await getConnectionInfo()
  if (!conn) throw new Error('Nicht verbunden')

  const res = await fetch(`${conn.serverUrl}/api/mobile${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${conn.deviceToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Fehler: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 2: Shipping API-Funktionen zum api-Objekt hinzufuegen**

Nach `completeOrderFulfillment`:

```typescript
  // --- Shipping Label APIs ---

  async getShippingMethods(): Promise<{ success: boolean; data: { id: number; name: string; carrier: string; default_cost: number; is_active: boolean }[] }> {
    return mobileFetch('/versand/shipping/methods')
  },

  async getSenderAddress(carrier: string): Promise<{ success: boolean; data: any; source: string }> {
    return mobileFetch(`/versand/shipping/sender-address/${carrier}`)
  },

  async createShippingLabel(body: {
    orderId: number; recipientName: string; recipientCompany?: string;
    recipientStreet: string; recipientPostalCode: string; recipientCity: string;
    recipientCountry?: string; recipientEmail?: string; recipientPhone?: string;
    weightKg?: number; product?: string; carrier: string;
    packageNumber?: number; totalPackages?: number;
  }): Promise<{ success: boolean; label?: any; error?: string }> {
    return mobilePost(`/versand/shipping/order/${body.orderId}/labels`, body)
  },

  async getLabelPdf(labelId: number): Promise<{ success: boolean; pdf: string }> {
    return mobileFetch(`/versand/shipping/labels/${labelId}/pdf`)
  },

  // --- Druckvorlagen APIs ---

  async getDruckvorlagen(type?: string): Promise<{ success: boolean; data: { id: number; name: string; document_type: string; is_default: boolean }[] }> {
    const params: Record<string, string> = {}
    if (type) params.type = type
    return mobileFetch('/versand/druckvorlagen', params)
  },

  async renderDruckvorlage(body: { templateId: number; orderId?: number; deliveryNoteId?: number; paperWidth?: number }): Promise<{ success: boolean; pdf: string }> {
    return mobilePost('/versand/druckvorlagen/render', body)
  },

  async getDeliveryNotes(orderId: number): Promise<{ success: boolean; data: any[] }> {
    return mobileFetch(`/versand/delivery-notes/order/${orderId}`)
  },
```

- [ ] **Step 3: Commit**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile
git add src/lib/api.ts
git commit -m "feat: Shipping Label + Druckvorlagen API-Funktionen"
```

---

## Task 4: Printer Library (mDNS + IPP)

**Files:**
- Create: `D:/SYNTROSOFT/syntrosoft-mobile/src/lib/printer.ts`

- [ ] **Step 1: react-native-zeroconf installieren**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile
npm install react-native-zeroconf
```

- [ ] **Step 2: Printer Library erstellen**

```typescript
// src/lib/printer.ts
import Zeroconf from 'react-native-zeroconf'
import AsyncStorage from '@react-native-async-storage/async-storage'

const PRINTER_STORAGE_KEY = '@syntrosoft_printers'

export interface NetworkPrinter {
  name: string
  host: string
  port: number
}

export interface PrinterAssignment {
  context: string
  printer: NetworkPrinter
}

// --- Discovery ---

export function discoverPrinters(timeoutMs = 5000): Promise<NetworkPrinter[]> {
  return new Promise((resolve) => {
    const zeroconf = new Zeroconf()
    const found: NetworkPrinter[] = []

    zeroconf.on('resolved', (service: any) => {
      if (service.host && service.port) {
        const existing = found.find(p => p.host === service.host && p.port === service.port)
        if (!existing) {
          found.push({
            name: service.name || service.host,
            host: service.host,
            port: service.port,
          })
        }
      }
    })

    zeroconf.scan('ipp', 'tcp', 'local.')

    setTimeout(() => {
      zeroconf.stop()
      zeroconf.removeAllListeners()
      resolve(found)
    }, timeoutMs)
  })
}

// --- Assignments ---

export async function loadAssignments(): Promise<PrinterAssignment[]> {
  const json = await AsyncStorage.getItem(PRINTER_STORAGE_KEY)
  return json ? JSON.parse(json) : []
}

export async function saveAssignment(context: string, printer: NetworkPrinter): Promise<void> {
  const assignments = await loadAssignments()
  const idx = assignments.findIndex(a => a.context === context)
  if (idx >= 0) {
    assignments[idx].printer = printer
  } else {
    assignments.push({ context, printer })
  }
  await AsyncStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(assignments))
}

export async function removeAssignment(context: string): Promise<void> {
  const assignments = await loadAssignments()
  const filtered = assignments.filter(a => a.context !== context)
  await AsyncStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(filtered))
}

export async function getPrinterForContext(context: string): Promise<NetworkPrinter | null> {
  const assignments = await loadAssignments()
  const match = assignments.find(a => a.context === context)
  return match?.printer || null
}

// --- IPP Print ---

export async function printPdf(printer: NetworkPrinter, pdfBase64: string): Promise<{ success: boolean; error?: string }> {
  try {
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))

    // IPP 1.1 Print-Job request
    const ippUrl = `http://${printer.host}:${printer.port}/ipp/print`

    // Build minimal IPP request
    const encoder = new IppEncoder()
    encoder.writeInt8(1) // version-major
    encoder.writeInt8(1) // version-minor
    encoder.writeInt16(0x0002) // operation: Print-Job
    encoder.writeInt32(1) // request-id

    // Operation attributes
    encoder.writeInt8(0x01) // operation-attributes-tag
    encoder.writeAttribute(0x47, 'attributes-charset', 'utf-8')
    encoder.writeAttribute(0x48, 'attributes-natural-language', 'de')
    encoder.writeAttribute(0x45, 'printer-uri', ippUrl)
    encoder.writeAttribute(0x49, 'document-format', 'application/pdf')

    // Job attributes
    encoder.writeInt8(0x02) // job-attributes-tag
    encoder.writeAttribute(0x42, 'job-name', 'SyntroSoft Print')

    encoder.writeInt8(0x03) // end-of-attributes-tag

    // Append PDF data
    const ippHeader = encoder.toBuffer()
    const fullBody = new Uint8Array(ippHeader.length + pdfBytes.length)
    fullBody.set(ippHeader)
    fullBody.set(pdfBytes, ippHeader.length)

    const response = await fetch(ippUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/ipp' },
      body: fullBody,
    })

    if (response.ok) {
      return { success: true }
    }
    return { success: false, error: `HTTP ${response.status}` }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Minimal IPP binary encoder
class IppEncoder {
  private parts: number[] = []

  writeInt8(v: number) { this.parts.push(v & 0xff) }
  writeInt16(v: number) { this.parts.push((v >> 8) & 0xff, v & 0xff) }
  writeInt32(v: number) { this.parts.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff) }

  writeAttribute(tag: number, name: string, value: string) {
    this.writeInt8(tag)
    this.writeInt16(name.length)
    for (let i = 0; i < name.length; i++) this.parts.push(name.charCodeAt(i))
    const valueBytes = new TextEncoder().encode(value)
    this.writeInt16(valueBytes.length)
    for (const b of valueBytes) this.parts.push(b)
  }

  toBuffer(): Uint8Array {
    return new Uint8Array(this.parts)
  }
}

// --- Convenience ---

export async function printWithContext(context: string, pdfBase64: string): Promise<{ success: boolean; error?: string }> {
  const printer = await getPrinterForContext(context)
  if (!printer) {
    return { success: false, error: `Kein Drucker fuer "${context}" konfiguriert` }
  }
  return printPdf(printer, pdfBase64)
}
```

- [ ] **Step 3: Commit**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile
git add src/lib/printer.ts
git commit -m "feat: Printer Library mit mDNS Discovery und IPP Print"
```

---

## Task 5: Versand-Wizard Container

**Files:**
- Create: `D:/SYNTROSOFT/syntrosoft-mobile/src/screens/VersandWizard.tsx`

- [ ] **Step 1: Wizard Container erstellen**

```typescript
// src/screens/VersandWizard.tsx
import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react-native'
import { Auftrag, OrderItem } from '../lib/api'
import { colors, spacing } from '../theme'
import { Step1Positionen } from './wizard/Step1Positionen'
import { Step2Pakete } from './wizard/Step2Pakete'
import { Step3Abschluss } from './wizard/Step3Abschluss'

export interface FulfillmentItem extends OrderItem {
  fulfillType: 'eigen' | 'strecke' | 'ekliste' | 'produktion' | 'skip'
  liefermenge: number
  supplierId?: number | null
  supplierName?: string | null
}

export interface CreatedLabel {
  id: number
  trackingNumber: string
  carrier: string
  pdfBase64?: string
}

interface VersandWizardProps {
  auftrag: Auftrag
  onClose: () => void
  onComplete: () => void
}

type WizardStep = 'positionen' | 'pakete' | 'abschluss'

export function VersandWizard({ auftrag, onClose, onComplete }: VersandWizardProps) {
  const [step, setStep] = useState<WizardStep>('positionen')
  const [items, setItems] = useState<FulfillmentItem[]>([])
  const [labels, setLabels] = useState<CreatedLabel[]>([])

  const hasEigen = items.some(i => i.fulfillType === 'eigen' && i.liefermenge > 0)
  const hasProduktion = items.some(i => i.fulfillType === 'produktion' && i.liefermenge > 0)

  const steps: WizardStep[] = ['positionen']
  if (hasEigen) steps.push('pakete')
  steps.push('abschluss')

  const currentIdx = steps.indexOf(step)
  const isLast = currentIdx === steps.length - 1
  const isFirst = currentIdx === 0

  const goNext = () => {
    if (!isLast) setStep(steps[currentIdx + 1])
  }

  const goBack = () => {
    if (isFirst) {
      onClose()
    } else {
      setStep(steps[currentIdx - 1])
    }
  }

  const stepLabels: Record<WizardStep, string> = {
    positionen: 'Positionen',
    pakete: 'Pakete & Labels',
    abschluss: 'Abschluss',
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>#{auftrag.order_number}</Text>
          <Text style={styles.headerStep}>{stepLabels[step]} ({currentIdx + 1}/{steps.length})</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Step Indicators */}
      <View style={styles.stepBar}>
        {steps.map((s, i) => (
          <View key={s} style={[styles.stepDot, i <= currentIdx && styles.stepDotActive]} />
        ))}
      </View>

      {/* Content */}
      {step === 'positionen' && (
        <Step1Positionen
          auftrag={auftrag}
          items={items}
          onItemsLoaded={setItems}
          onNext={goNext}
        />
      )}
      {step === 'pakete' && (
        <Step2Pakete
          auftrag={auftrag}
          items={items.filter(i => i.fulfillType === 'eigen' && i.liefermenge > 0)}
          labels={labels}
          onLabelsChange={setLabels}
          onNext={goNext}
        />
      )}
      {step === 'abschluss' && (
        <Step3Abschluss
          auftrag={auftrag}
          items={items}
          labels={labels}
          onComplete={onComplete}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  headerStep: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  stepBar: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingVertical: spacing.sm,
  },
  stepDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.border,
  },
  stepDotActive: { backgroundColor: colors.primary },
})
```

- [ ] **Step 2: Commit**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile
git add src/screens/VersandWizard.tsx
git commit -m "feat: VersandWizard Container mit Step-Navigation"
```

---

## Task 6: Step 1 - Positionen mit Mengenbearbeitung

**Files:**
- Create: `D:/SYNTROSOFT/syntrosoft-mobile/src/screens/wizard/Step1Positionen.tsx`

- [ ] **Step 1: Wizard-Verzeichnis anlegen**

```bash
mkdir -p D:/SYNTROSOFT/syntrosoft-mobile/src/screens/wizard
```

- [ ] **Step 2: Step1Positionen erstellen**

```typescript
// src/screens/wizard/Step1Positionen.tsx
import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Minus, Plus } from 'lucide-react-native'
import { api, Auftrag, OrderItem } from '../../lib/api'
import { colors, spacing } from '../../theme'
import { FulfillmentItem } from '../VersandWizard'

interface Props {
  auftrag: Auftrag
  items: FulfillmentItem[]
  onItemsLoaded: (items: FulfillmentItem[]) => void
  onNext: () => void
}

const TYPES = [
  { key: 'eigen' as const, label: 'Eigen', color: '#3b82f6' },
  { key: 'strecke' as const, label: 'Strecke', color: '#a855f7' },
  { key: 'ekliste' as const, label: 'EK', color: '#f59e0b' },
  { key: 'produktion' as const, label: 'Prod.', color: '#ec4899' },
  { key: 'skip' as const, label: 'Skip', color: '#6b7280' },
]

export function Step1Positionen({ auftrag, items, onItemsLoaded, onNext }: Props) {
  const [loading, setLoading] = useState(items.length === 0)

  useEffect(() => {
    if (items.length > 0) return
    loadItems()
  }, [])

  const loadItems = async () => {
    setLoading(true)
    try {
      const res = await api.getOrderItemsForFulfillment(auftrag.id)
      const artikelItems = (res?.items || []).filter((i: OrderItem) => i.item_type === 'artikel' || !i.item_type)
      const mapped: FulfillmentItem[] = artikelItems.map((i: OrderItem) => {
        const openQty = Math.max(0, Math.round(Number(i.quantity) - Number(i.quantity_fulfilled || 0)))
        const hasStock = (Number(i.stock_total) || 0) > 0
        const isProduktion = !!(i as any).produktions_artikel_id
        let fulfillType: FulfillmentItem['fulfillType'] = 'ekliste'
        if (isProduktion) fulfillType = 'produktion'
        else if (hasStock) fulfillType = 'eigen'
        else if (i.default_supplier_id) fulfillType = 'strecke'

        return {
          ...i,
          fulfillType,
          liefermenge: openQty,
          supplierId: i.default_supplier_id,
          supplierName: i.default_supplier_name,
        }
      })
      onItemsLoaded(mapped)
    } catch { onItemsLoaded([]) }
    setLoading(false)
  }

  const updateItem = (idx: number, updates: Partial<FulfillmentItem>) => {
    const updated = [...items]
    updated[idx] = { ...updated[idx], ...updates }
    onItemsLoaded(updated)
  }

  const activeCount = items.filter(i => i.fulfillType !== 'skip' && i.liefermenge > 0).length

  if (loading) {
    return <View style={s.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  return (
    <View style={s.container}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {items.map((item, idx) => {
          const openQty = Math.max(0, Math.round(Number(item.quantity) - Number(item.quantity_fulfilled || 0)))
          return (
            <View key={item.id} style={s.card}>
              {/* Artikel-Info */}
              <View style={s.articleRow}>
                {item.article_number && <Text style={s.artNr}>{item.article_number}</Text>}
                <Text style={s.artName} numberOfLines={2}>{item.article_name || 'Unbekannt'}</Text>
                <Text style={s.stockInfo}>
                  Bedarf: {openQty} | Lager: {Math.round(Number(item.stock_total) || 0)}
                </Text>
              </View>

              {/* Versandart-Segmente */}
              <View style={s.segments}>
                {TYPES.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[s.segBtn, item.fulfillType === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                    onPress={() => updateItem(idx, { fulfillType: t.key })}
                  >
                    <Text style={[s.segText, item.fulfillType === t.key && { color: '#fff' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Mengenbearbeitung */}
              {item.fulfillType !== 'skip' && (
                <View style={s.qtyRow}>
                  <Text style={s.qtyLabel}>Menge:</Text>
                  <TouchableOpacity
                    style={s.qtyBtn}
                    onPress={() => updateItem(idx, { liefermenge: Math.max(0, item.liefermenge - 1) })}
                  >
                    <Minus size={14} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={s.qtyValue}>{item.liefermenge}</Text>
                  <TouchableOpacity
                    style={s.qtyBtn}
                    onPress={() => updateItem(idx, { liefermenge: Math.min(openQty, item.liefermenge + 1) })}
                  >
                    <Plus size={14} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={s.qtyMax}>/ {openQty}</Text>
                </View>
              )}

              {/* Lieferant bei Strecke */}
              {item.fulfillType === 'strecke' && (item.suppliers || []).length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.supplierScroll}>
                  {(item.suppliers || []).map((sup: any) => (
                    <TouchableOpacity
                      key={sup.id}
                      style={[s.supplierChip, item.supplierId === sup.id && s.supplierChipActive]}
                      onPress={() => updateItem(idx, { supplierId: sup.id, supplierName: sup.name })}
                    >
                      <Text style={[s.supplierText, item.supplierId === sup.id && { color: '#fff' }]} numberOfLines={1}>
                        {sup.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )
        })}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>{activeCount} Position(en) zugewiesen</Text>
        <TouchableOpacity
          style={[s.nextBtn, activeCount === 0 && { opacity: 0.4 }]}
          onPress={onNext}
          disabled={activeCount === 0}
        >
          <Text style={s.nextBtnText}>Weiter</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  articleRow: { marginBottom: spacing.sm },
  artNr: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  artName: { fontSize: 14, color: colors.text, marginTop: 2 },
  stockInfo: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  segments: { flexDirection: 'row', gap: 4, marginBottom: spacing.sm },
  segBtn: {
    flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  segText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyLabel: { fontSize: 13, color: colors.textSecondary },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.surfaceHover,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyValue: { fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 30, textAlign: 'center' },
  qtyMax: { fontSize: 12, color: colors.textMuted },
  supplierScroll: { marginTop: spacing.sm },
  supplierChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: colors.surfaceHover, marginRight: 8,
  },
  supplierChipActive: { backgroundColor: '#a855f7' },
  supplierText: { fontSize: 12, color: colors.textSecondary },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerText: { fontSize: 13, color: colors.textSecondary },
  nextBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 8,
  },
  nextBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
```

- [ ] **Step 3: Commit**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile
git add src/screens/wizard/Step1Positionen.tsx
git commit -m "feat: Step1 Positionen mit Mengenbearbeitung und Versandart-Auswahl"
```

---

## Task 7: Step 2 - Pakete & Labels

**Files:**
- Create: `D:/SYNTROSOFT/syntrosoft-mobile/src/screens/wizard/Step2Pakete.tsx`

- [ ] **Step 1: Step2Pakete erstellen**

```typescript
// src/screens/wizard/Step2Pakete.tsx
import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { Plus, Printer, Trash2 } from 'lucide-react-native'
import { api, Auftrag } from '../../lib/api'
import { colors, spacing } from '../../theme'
import { FulfillmentItem, CreatedLabel } from '../VersandWizard'
import { printWithContext } from '../../lib/printer'

interface Props {
  auftrag: Auftrag
  items: FulfillmentItem[]
  labels: CreatedLabel[]
  onLabelsChange: (labels: CreatedLabel[]) => void
  onNext: () => void
}

interface PackageDraft {
  id: number
  weightKg: string
  creating: boolean
}

const CARRIERS = [
  { key: 'dhl', label: 'DHL' },
  { key: 'dpd', label: 'DPD' },
]

const DHL_PRODUCTS = [
  { key: 'V01PAK', label: 'Paket' },
  { key: 'V53WPAK', label: 'Sperrgut' },
  { key: 'V62WP', label: 'Warenpost' },
]

let nextPkgId = 1

export function Step2Pakete({ auftrag, items, labels, onLabelsChange, onNext }: Props) {
  const [carrier, setCarrier] = useState('dhl')
  const [dhlProduct, setDhlProduct] = useState('V01PAK')
  const [packages, setPackages] = useState<PackageDraft[]>([{ id: nextPkgId++, weightKg: '1', creating: false }])

  const createLabel = async (pkgIdx: number) => {
    const pkg = packages[pkgIdx]
    const updated = [...packages]
    updated[pkgIdx] = { ...pkg, creating: true }
    setPackages(updated)

    try {
      const detail = (auftrag as any)
      const res = await api.createShippingLabel({
        orderId: auftrag.id,
        recipientName: [detail.shipping_first_name || detail.billing_first_name, detail.shipping_last_name || detail.billing_last_name].filter(Boolean).join(' ') || 'Unbekannt',
        recipientCompany: detail.shipping_company || detail.billing_company || '',
        recipientStreet: detail.shipping_street || detail.billing_street || '',
        recipientPostalCode: detail.shipping_postal_code || detail.billing_postal_code || '',
        recipientCity: detail.shipping_city || detail.billing_city || '',
        recipientCountry: detail.shipping_country || detail.billing_country || 'DE',
        recipientEmail: detail.shipping_email || detail.billing_email || '',
        weightKg: parseFloat(pkg.weightKg) || 1,
        carrier,
        product: carrier === 'dhl' ? dhlProduct : undefined,
        packageNumber: pkgIdx + 1,
        totalPackages: packages.length,
      })

      if (res.success && res.label) {
        // PDF laden
        let pdfBase64: string | undefined
        try {
          const pdfRes = await api.getLabelPdf(res.label.id)
          if (pdfRes.success) pdfBase64 = pdfRes.pdf
        } catch {}

        onLabelsChange([...labels, {
          id: res.label.id,
          trackingNumber: res.label.tracking_number,
          carrier: carrier.toUpperCase(),
          pdfBase64,
        }])
      } else {
        Alert.alert('Fehler', res.error || 'Label konnte nicht erstellt werden')
      }
    } catch (e: any) {
      Alert.alert('Fehler', e.message)
    }

    const final = [...packages]
    final[pkgIdx] = { ...final[pkgIdx], creating: false }
    setPackages(final)
  }

  const printLabel = async (label: CreatedLabel) => {
    if (!label.pdfBase64) {
      Alert.alert('Fehler', 'Kein PDF vorhanden')
      return
    }
    const result = await printWithContext(`carrier:${label.carrier.toLowerCase()}`, label.pdfBase64)
    if (!result.success) {
      Alert.alert('Druckfehler', result.error || 'Drucken fehlgeschlagen')
    }
  }

  const addPackage = () => {
    setPackages([...packages, { id: nextPkgId++, weightKg: '1', creating: false }])
  }

  const removePackage = (idx: number) => {
    if (packages.length <= 1) return
    setPackages(packages.filter((_, i) => i !== idx))
  }

  return (
    <View style={s.container}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Positionen-Zusammenfassung */}
        <View style={s.summary}>
          <Text style={s.summaryTitle}>Eigenversand ({items.length} Pos.)</Text>
          {items.map(i => (
            <Text key={i.id} style={s.summaryItem}>
              {i.article_number} - {i.liefermenge}x {i.article_name}
            </Text>
          ))}
        </View>

        {/* Carrier-Auswahl */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Versanddienstleister</Text>
          <View style={s.segments}>
            {CARRIERS.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[s.segBtn, carrier === c.key && s.segBtnActive]}
                onPress={() => setCarrier(c.key)}
              >
                <Text style={[s.segText, carrier === c.key && { color: '#fff' }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* DHL Produkt */}
        {carrier === 'dhl' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>DHL Produkt</Text>
            <View style={s.segments}>
              {DHL_PRODUCTS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[s.segBtn, dhlProduct === p.key && s.segBtnActive]}
                  onPress={() => setDhlProduct(p.key)}
                >
                  <Text style={[s.segText, dhlProduct === p.key && { color: '#fff' }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Pakete */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Pakete</Text>
          {packages.map((pkg, idx) => (
            <View key={pkg.id} style={s.packageCard}>
              <View style={s.packageHeader}>
                <Text style={s.packageTitle}>Paket {idx + 1}</Text>
                {packages.length > 1 && (
                  <TouchableOpacity onPress={() => removePackage(idx)}>
                    <Trash2 size={16} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.weightRow}>
                <Text style={s.weightLabel}>Gewicht (kg):</Text>
                <TextInput
                  style={s.weightInput}
                  value={pkg.weightKg}
                  onChangeText={v => {
                    const updated = [...packages]
                    updated[idx] = { ...pkg, weightKg: v }
                    setPackages(updated)
                  }}
                  keyboardType="decimal-pad"
                  placeholder="1.0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              {/* Label fuer dieses Paket? */}
              {labels[idx] ? (
                <View style={s.labelRow}>
                  <Text style={s.labelText}>{labels[idx].carrier}: {labels[idx].trackingNumber}</Text>
                  <TouchableOpacity style={s.printBtn} onPress={() => printLabel(labels[idx])}>
                    <Printer size={14} color="#fff" />
                    <Text style={s.printBtnText}>Drucken</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.createBtn, pkg.creating && { opacity: 0.5 }]}
                  onPress={() => createLabel(idx)}
                  disabled={pkg.creating}
                >
                  {pkg.creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.createBtnText}>Label erstellen</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={s.addBtn} onPress={addPackage}>
            <Plus size={16} color={colors.primary} />
            <Text style={s.addBtnText}>Paket hinzufuegen</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>{labels.length} Label(s) erstellt</Text>
        <TouchableOpacity style={s.nextBtn} onPress={onNext}>
          <Text style={s.nextBtnText}>Weiter</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  summary: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  summaryTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
  summaryItem: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  section: { marginBottom: spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  segments: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  segBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  packageCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  packageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  packageTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  weightLabel: { fontSize: 13, color: colors.textSecondary },
  weightInput: {
    flex: 1, height: 40, backgroundColor: colors.surfaceHover, borderRadius: 8,
    paddingHorizontal: 12, color: colors.text, fontSize: 14,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelText: { fontSize: 12, color: colors.success, fontWeight: '600', flex: 1 },
  printBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#a855f7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
  },
  printBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  createBtn: {
    backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addBtnText: { color: colors.primary, fontSize: 13, fontWeight: '500' },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerText: { fontSize: 13, color: colors.textSecondary },
  nextBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  nextBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
```

- [ ] **Step 2: Commit**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile
git add src/screens/wizard/Step2Pakete.tsx
git commit -m "feat: Step2 Pakete mit Carrier-Wahl und Label-Erstellung"
```

---

## Task 8: Step 3 - Abschluss

**Files:**
- Create: `D:/SYNTROSOFT/syntrosoft-mobile/src/screens/wizard/Step3Abschluss.tsx`

- [ ] **Step 1: Step3Abschluss erstellen**

```typescript
// src/screens/wizard/Step3Abschluss.tsx
import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { CheckCircle, Printer, Package, Truck, ShoppingCart, Settings } from 'lucide-react-native'
import { api, Auftrag } from '../../lib/api'
import { colors, spacing } from '../../theme'
import { FulfillmentItem, CreatedLabel } from '../VersandWizard'
import { printWithContext } from '../../lib/printer'
import { useQueryClient } from '@tanstack/react-query'
import { getConnectionInfo } from '../../lib/auth'

interface Props {
  auftrag: Auftrag
  items: FulfillmentItem[]
  labels: CreatedLabel[]
  onComplete: () => void
}

export function Step3Abschluss({ auftrag, items, labels, onComplete }: Props) {
  const queryClient = useQueryClient()
  const [templates, setTemplates] = useState<{ id: number; name: string; is_default: boolean }[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const eigenItems = items.filter(i => i.fulfillType === 'eigen' && i.liefermenge > 0)
  const streckeItems = items.filter(i => i.fulfillType === 'strecke' && i.liefermenge > 0)
  const ekItems = items.filter(i => i.fulfillType === 'ekliste' && i.liefermenge > 0)
  const prodItems = items.filter(i => i.fulfillType === 'produktion' && i.liefermenge > 0)

  useEffect(() => {
    api.getDruckvorlagen('lieferschein').then(res => {
      if (res.success && res.data) {
        setTemplates(res.data)
        const def = res.data.find(t => t.is_default)
        if (def) setSelectedTemplate(def.id)
        else if (res.data.length > 0) setSelectedTemplate(res.data[0].id)
      }
    }).catch(() => {})
  }, [])

  const submit = async () => {
    setSubmitting(true)
    try {
      // 1. Fulfillment (Eigen + Strecke + Produktion)
      const fulfillments = [
        ...eigenItems.map(i => ({
          orderItemId: i.id, fulfillmentType: 'eigenversand' as const,
          quantity: i.liefermenge, shippingLabelId: labels[0]?.id,
        })),
        ...streckeItems.map(i => ({
          orderItemId: i.id, fulfillmentType: 'dropshipping' as const,
          quantity: i.liefermenge, supplierId: i.supplierId!,
        })),
        ...prodItems.map(i => ({
          orderItemId: i.id, fulfillmentType: 'produktion' as const,
          quantity: i.liefermenge,
        })),
      ]
      if (fulfillments.length > 0) {
        await api.completeOrderFulfillment(auftrag.id, fulfillments)
      }

      // 2. Einkaufsliste
      if (ekItems.length > 0) {
        const conn = await getConnectionInfo()
        if (conn) {
          await fetch(`${conn.serverUrl}/api/mobile/versand/shopping-list/batch`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${conn.deviceToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: ekItems.map(i => ({
                artikel_nummer: i.article_number,
                artikel_name: i.article_name,
                menge: i.liefermenge,
                einheit: i.unit || 'Stk',
                order_id: auftrag.id,
                order_number: auftrag.order_number,
                supplier_id: i.default_supplier_id,
                supplier_name: i.default_supplier_name,
              })),
            }),
          })
        }
      }

      // 3. Lieferschein drucken
      if (selectedTemplate) {
        try {
          const renderRes = await api.renderDruckvorlage({
            templateId: selectedTemplate,
            orderId: auftrag.id,
            paperWidth: 102,
          })
          if (renderRes.success && renderRes.pdf) {
            const printRes = await printWithContext('doctype:lieferschein', renderRes.pdf)
            if (!printRes.success) {
              Alert.alert('Druck-Hinweis', `Lieferschein konnte nicht gedruckt werden: ${printRes.error}`)
            }
          }
        } catch (e: any) {
          Alert.alert('Druck-Hinweis', `Lieferschein-Fehler: ${e.message}`)
        }
      }

      queryClient.invalidateQueries({ queryKey: ['auftraege'] })
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] })
      setDone(true)
    } catch (e: any) {
      Alert.alert('Fehler', e.message)
    }
    setSubmitting(false)
  }

  if (done) {
    return (
      <View style={s.doneContainer}>
        <CheckCircle size={64} color={colors.success} />
        <Text style={s.doneTitle}>Auslieferung abgeschlossen</Text>
        <Text style={s.doneSubtitle}>#{auftrag.order_number}</Text>
        <TouchableOpacity style={s.doneBtn} onPress={onComplete}>
          <Text style={s.doneBtnText}>Fertig</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Eigenversand */}
        {eigenItems.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Truck size={16} color="#3b82f6" />
              <Text style={s.sectionTitle}>Eigenversand ({eigenItems.length})</Text>
            </View>
            {eigenItems.map(i => (
              <Text key={i.id} style={s.itemText}>{i.liefermenge}x {i.article_name}</Text>
            ))}
            {labels.length > 0 && labels.map((l, idx) => (
              <Text key={idx} style={s.labelInfo}>{l.carrier}: {l.trackingNumber}</Text>
            ))}
          </View>
        )}

        {/* Strecke */}
        {streckeItems.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Package size={16} color="#a855f7" />
              <Text style={s.sectionTitle}>Strecke ({streckeItems.length})</Text>
            </View>
            {streckeItems.map(i => (
              <Text key={i.id} style={s.itemText}>{i.liefermenge}x {i.article_name} → {i.supplierName}</Text>
            ))}
          </View>
        )}

        {/* Einkaufsliste */}
        {ekItems.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <ShoppingCart size={16} color="#f59e0b" />
              <Text style={s.sectionTitle}>Einkaufsliste ({ekItems.length})</Text>
            </View>
            {ekItems.map(i => (
              <Text key={i.id} style={s.itemText}>{i.liefermenge}x {i.article_name}</Text>
            ))}
          </View>
        )}

        {/* Produktion */}
        {prodItems.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Settings size={16} color="#ec4899" />
              <Text style={s.sectionTitle}>Produktion ({prodItems.length})</Text>
            </View>
            {prodItems.map(i => (
              <Text key={i.id} style={s.itemText}>{i.liefermenge}x {i.article_name}</Text>
            ))}
          </View>
        )}

        {/* Lieferschein-Template */}
        {templates.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Printer size={16} color={colors.textSecondary} />
              <Text style={s.sectionTitle}>Lieferschein</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {templates.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.templateChip, selectedTemplate === t.id && s.templateChipActive]}
                  onPress={() => setSelectedTemplate(t.id)}
                >
                  <Text style={[s.templateText, selectedTemplate === t.id && { color: '#fff' }]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.submitBtn, submitting && { opacity: 0.5 }]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.submitBtnText}>Ausliefern</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  section: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  labelInfo: { fontSize: 12, color: colors.success, fontWeight: '600', marginTop: 4 },
  templateChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: colors.surfaceHover, marginRight: 8,
  },
  templateChipActive: { backgroundColor: colors.primary },
  templateText: { fontSize: 13, color: colors.textSecondary },
  footer: {
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  submitBtn: {
    backgroundColor: colors.success, paddingVertical: 14, borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  doneContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  doneTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  doneSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  doneBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 40, paddingVertical: 12,
    borderRadius: 10, marginTop: spacing.lg,
  },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 2: Commit**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile
git add src/screens/wizard/Step3Abschluss.tsx
git commit -m "feat: Step3 Abschluss mit Zusammenfassung, Lieferschein und Druck"
```

---

## Task 9: Wizard in AuftraegeScreen einbinden

**Files:**
- Modify: `D:/SYNTROSOFT/syntrosoft-mobile/src/screens/AuftraegeScreen.tsx`

- [ ] **Step 1: Import hinzufuegen**

Oben in den Imports:

```typescript
import { VersandWizard } from './VersandWizard'
```

- [ ] **Step 2: Wizard-State hinzufuegen**

Nach `const [fulfillSaving, setFulfillSaving] = useState(false)`:

```typescript
const [wizardOrder, setWizardOrder] = useState<Auftrag | null>(null)
```

- [ ] **Step 3: Wizard rendern**

Vor dem `return (` in der Hauptkomponente, nach dem bestehenden `renderAuftrag`:

```typescript
  if (wizardOrder) {
    return (
      <VersandWizard
        auftrag={wizardOrder}
        onClose={() => setWizardOrder(null)}
        onComplete={() => {
          setWizardOrder(null)
          queryClient.invalidateQueries({ queryKey: ['auftraege'] })
        }}
      />
    )
  }
```

- [ ] **Step 4: Kontext-Menue "Ausliefern" auf Wizard umleiten**

Den bestehenden `onPress` fuer "Ausliefern" im Kontext-Menue aendern:

```typescript
// Alt:
<TouchableOpacity style={styles.contextItem} onPress={() => contextOrder && openFulfillment(contextOrder)}>
// Neu:
<TouchableOpacity style={styles.contextItem} onPress={() => { setWizardOrder(contextOrder); setContextOrder(null) }}>
```

- [ ] **Step 5: Altes Fulfillment-Modal entfernen**

Das gesamte `{/* Ausliefern Modal */}` Modal (ca. Zeilen 560-670) kann entfernt werden, da der Wizard es ersetzt. Ebenso die States `fulfillOrder`, `fulfillItems`, `fulfillLoading`, `fulfillSaving` und die Funktionen `openFulfillment`, `confirmFulfillment`, `doFulfillment`.

- [ ] **Step 6: Commit**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile
git add src/screens/AuftraegeScreen.tsx
git commit -m "feat: Versand-Wizard statt inline Fulfillment-Modal"
```

---

## Task 10: Drucker-Einstellungen

**Files:**
- Modify: `D:/SYNTROSOFT/syntrosoft-mobile/src/screens/EinstellungenScreen.tsx`

- [ ] **Step 1: Imports und State hinzufuegen**

```typescript
import { discoverPrinters, loadAssignments, saveAssignment, removeAssignment, NetworkPrinter, PrinterAssignment } from '../lib/printer'
```

Neue States in der Komponente:

```typescript
const [printerAssignments, setPrinterAssignments] = useState<PrinterAssignment[]>([])
const [discoveredPrinters, setDiscoveredPrinters] = useState<NetworkPrinter[]>([])
const [scanning, setScanning] = useState(false)
const [assignContext, setAssignContext] = useState<string | null>(null)

useEffect(() => { loadAssignments().then(setPrinterAssignments) }, [])
```

- [ ] **Step 2: Drucker-Sektion hinzufuegen**

Nach der bestehenden "Darstellung" Sektion, vor dem Disconnect-Button:

```typescript
{/* Drucker */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Drucker</Text>

  <TouchableOpacity
    style={[styles.settingRow, scanning && { opacity: 0.5 }]}
    onPress={async () => {
      setScanning(true)
      const found = await discoverPrinters()
      setDiscoveredPrinters(found)
      setScanning(false)
      if (found.length === 0) Alert.alert('Keine Drucker', 'Keine Netzwerkdrucker gefunden.')
    }}
    disabled={scanning}
  >
    <Text style={styles.settingLabel}>{scanning ? 'Suche laueft...' : 'Drucker suchen'}</Text>
    {scanning && <ActivityIndicator size="small" color={colors.primary} />}
  </TouchableOpacity>

  {[
    { context: 'doctype:lieferschein', label: 'Lieferschein' },
    { context: 'doctype:paketschein', label: 'Paketschein' },
    { context: 'carrier:dhl', label: 'DHL Labels' },
    { context: 'carrier:dpd', label: 'DPD Labels' },
  ].map(ctx => {
    const assignment = printerAssignments.find(a => a.context === ctx.context)
    return (
      <TouchableOpacity
        key={ctx.context}
        style={styles.settingRow}
        onPress={() => {
          if (discoveredPrinters.length === 0) {
            Alert.alert('Drucker suchen', 'Bitte zuerst "Drucker suchen" ausfuehren.')
            return
          }
          setAssignContext(ctx.context)
        }}
        onLongPress={() => {
          if (assignment) {
            Alert.alert('Drucker entfernen', `${ctx.label} Zuordnung aufheben?`, [
              { text: 'Abbrechen', style: 'cancel' },
              { text: 'Entfernen', style: 'destructive', onPress: async () => {
                await removeAssignment(ctx.context)
                setPrinterAssignments(await loadAssignments())
              }},
            ])
          }
        }}
      >
        <Text style={styles.settingLabel}>{ctx.label}</Text>
        <Text style={styles.settingValue}>
          {assignment ? assignment.printer.name : 'Nicht zugewiesen'}
        </Text>
      </TouchableOpacity>
    )
  })}
</View>

{/* Drucker-Auswahl Modal */}
<Modal visible={!!assignContext} transparent animationType="fade" onRequestClose={() => setAssignContext(null)}>
  <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAssignContext(null)}>
    <View style={styles.printerModal}>
      <Text style={styles.printerModalTitle}>Drucker waehlen</Text>
      {discoveredPrinters.map((p, i) => (
        <TouchableOpacity
          key={i}
          style={styles.printerOption}
          onPress={async () => {
            if (assignContext) {
              await saveAssignment(assignContext, p)
              setPrinterAssignments(await loadAssignments())
            }
            setAssignContext(null)
          }}
        >
          <Text style={styles.printerName}>{p.name}</Text>
          <Text style={styles.printerHost}>{p.host}:{p.port}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </TouchableOpacity>
</Modal>
```

- [ ] **Step 3: Styles fuer Drucker-Sektion**

```typescript
printerModal: {
  backgroundColor: colors.surface, borderRadius: 16, width: '80%', maxWidth: 320,
  padding: spacing.md, borderWidth: 1, borderColor: colors.border,
},
printerModalTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
printerOption: {
  paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
},
printerName: { fontSize: 14, fontWeight: '500', color: colors.text },
printerHost: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
```

- [ ] **Step 4: Commit**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile
git add src/screens/EinstellungenScreen.tsx
git commit -m "feat: Drucker-Einstellungen mit mDNS Discovery und Kontext-Zuordnung"
```

---

## Task 11: Integration, Auftrag-Detail laden fuer Labels

**Files:**
- Modify: `D:/SYNTROSOFT/syntrosoft-mobile/src/screens/VersandWizard.tsx`

- [ ] **Step 1: Auftrag-Detail laden fuer Adressdaten**

Der Wizard braucht die vollen Adressdaten fuer Labels. Im VersandWizard State hinzufuegen:

```typescript
const [auftragDetail, setAuftragDetail] = useState<any>(null)

useEffect(() => {
  api.getAuftrag(auftrag.id).then(res => {
    if (res.success) setAuftragDetail(res.data)
  })
}, [auftrag.id])
```

Und `auftragDetail` statt `auftrag` an Step2Pakete weitergeben:

```typescript
{step === 'pakete' && auftragDetail && (
  <Step2Pakete
    auftrag={auftragDetail}
    items={items.filter(i => i.fulfillType === 'eigen' && i.liefermenge > 0)}
    labels={labels}
    onLabelsChange={setLabels}
    onNext={goNext}
  />
)}
```

- [ ] **Step 2: api import hinzufuegen**

```typescript
import { api, Auftrag, OrderItem } from '../lib/api'
```

- [ ] **Step 3: Commit**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile
git add src/screens/VersandWizard.tsx
git commit -m "feat: Auftrag-Detail laden fuer Label-Adressdaten"
```

---

## Task 12: Build, Test und Deploy

- [ ] **Step 1: TypeScript Check**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile && npx tsc --noEmit
```

- [ ] **Step 2: Alle Aenderungen committen und pushen**

```bash
# Mobile
cd D:/SYNTROSOFT/syntrosoft-mobile
git push origin master

# Admin-Backend
cd D:/SYNTROSOFT/syntrosoft-admin-backend
git push origin main

# Electron-Backend
cd D:/SYNTROSOFT/syntrosoft-electron-back
git push origin main
```

- [ ] **Step 3: APK bauen und releasen**

```bash
cd D:/SYNTROSOFT/syntrosoft-mobile/android && ./gradlew assembleRelease
```

GitHub Release erstellen und APK hochladen.

- [ ] **Step 4: Manueller Test**

Auf dem Handy testen:
1. Auftrag oeffnen → Long-Press → Ausliefern
2. Positionen zuweisen mit verschiedenen Typen + Mengen anpassen
3. Pakete Step: Carrier waehlen, Label erstellen
4. Abschluss: Lieferschein-Template waehlen, Ausliefern
5. Einstellungen: Drucker suchen und zuweisen
6. Drucken testen (Label + Lieferschein)
