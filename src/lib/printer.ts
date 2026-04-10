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
    const binaryString = atob(pdfBase64)
    const pdfBytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      pdfBytes[i] = binaryString.charCodeAt(i)
    }

    const ippUrl = `http://${printer.host}:${printer.port}/ipp/print`

    // Build minimal IPP 1.1 Print-Job request
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
