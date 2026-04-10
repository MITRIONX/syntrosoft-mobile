# Versand-Wizard Mobile App - Design Spec

## Ziel

Vollständiger Versand-Workflow auf dem Handy: Ware kommt an → Positionen zuweisen → Label erstellen → Lieferschein drucken → fertig. Gleiche Funktionalität wie der Desktop-Wizard (VersandCheckoutModal), optimiert für Touch.

## Architektur

```
App (React Native)              Backend (Express)              Drucker (QL-1110NWB)
     │                               │                              │
     │── Step 1: Positionen ────────→│                              │
     │   (Mengen, Versandart)        │                              │
     │                               │                              │
     │── Step 2: Pakete ────────────→│── DHL/DPD API               │
     │   (Carrier, Label)            │←─ Label PDF                  │
     │                               │                              │
     │── Step 2b: Produktion ───────→│── Produktionsauftrag         │
     │                               │                              │
     │── Step 3: Abschluss ─────────→│── completeOrder              │
     │   (Lieferschein drucken)      │── render PDF ───────── IPP ─→│
```

## Wizard-Steps

### Step 1: Positionen zuweisen

Alle Artikel-Positionen des Auftrags laden via `GET /api/mobile/versand/shipping/order/:id/items`.

Pro Position anzeigen:
- Artikelnummer + Name
- Bestellmenge / bereits erfüllte Menge / offene Restmenge
- Lagerbestand (stock_total)
- Standard-Lieferant

Pro Position auswählen:
- **Versandart** via Segmented Buttons: Eigen | Strecke | EK | Produktion | Skip
- **Liefermenge** via +/- Buttons (default: offene Restmenge, max: offene Restmenge)
- **Lieferant** bei Strecke: Chip-Auswahl aus `item.suppliers[]`

Auto-Vorauswahl:
- Bestand > 0 → Eigenversand
- Bestand = 0 + Standard-Lieferant → Strecke
- Sonst → EK-Liste
- Produktionsartikel (produktions_artikel_id gesetzt) → Produktion

Weiter-Button: validiert dass mindestens eine Position zugewiesen ist.

### Step 2: Pakete & Labels

Wird nur angezeigt wenn Eigenversand-Positionen vorhanden sind.

**Carrier-Auswahl:** DHL | DPD (Segmented Buttons)

**DHL-Produkte:** V01PAK (Paket) | V53WPAK (Sperrgut) | V62WP (Warenpost)

**Pro Paket:**
- Gewicht (kg) - numerisches Eingabefeld
- "Label erstellen" Button → `POST /api/mobile/shipping/create-label`
- Label-Vorschau (PDF als Image rendern oder Erfolgs-Badge)
- "Drucken" Button → PDF an konfigurierten Carrier-Drucker senden

**Mehrere Pakete:** "+ Paket" Button für Mehrstück-Sendungen.

**Absenderadresse:** Wird vom Backend geladen via `GET /api/mobile/versand/shipping/sender-address/:carrier`.

API-Calls:
- `POST /api/mobile/versand/shipping/order/:orderId/labels` - Label erstellen
- `GET /api/mobile/versand/shipping/labels/:labelId/pdf` - Label PDF abrufen

### Step 2b: Produktion

Wird nur angezeigt wenn Produktions-Positionen vorhanden sind.

Zeigt Zusammenfassung der Produktionsartikel:
- Artikelname + Menge
- Bestätigung dass Produktionsauftrag erstellt werden soll

### Step 3: Abschluss

**Zusammenfassung** aller Aktionen gruppiert:

1. **Eigenversand** - Pakete mit Tracking-Nummern
2. **Strecke/Dropshipping** - gruppiert pro Lieferant
   - Versandmethode wählen: Webshop | Email | Telefon | API | FTP
3. **Einkaufsliste** - Artikel die nachbestellt werden
4. **Produktion** - Produktionsaufträge

**Lieferschein:**
- Template-Auswahl Dropdown (aus `GET /api/mobile/druckvorlagen?type=lieferschein`)
- "Lieferschein drucken" Button

**"Ausliefern" Button:**
1. `POST /api/mobile/versand/shipping/order/:orderId/complete` - Fulfillment speichern
2. EK-Liste Items → `POST /api/mobile/versand/shopping-list/batch`
3. Produktionsaufträge erstellen (wenn vorhanden)
4. Lieferschein PDF rendern + an Drucker senden
5. Erfolgs-Screen

## Drucker-System

### mDNS Discovery

Bibliothek: `react-native-zeroconf`

Sucht nach `_ipp._tcp` und `_ipps._tcp` Services im lokalen Netz. Der Brother QL-1110NWB advertised sich als IPP-Drucker mit Service-Name und IP/Port.

Discovery-Ergebnis pro Drucker:
```typescript
interface NetworkPrinter {
  name: string        // z.B. "Brother QL-1110NWB"
  host: string        // z.B. "192.168.1.42"
  port: number        // z.B. 631
  txt?: Record<string, string>  // mDNS TXT records
}
```

### Drucker-Zuordnung (Einstellungen)

In den App-Einstellungen neue Sektion "Drucker":

**Kontexte:**
- `doctype:lieferschein` - Lieferschein-Drucker
- `doctype:paketschein` - Paketschein-Drucker (Fallback: Lieferschein-Drucker)
- `carrier:dhl` - DHL Labels
- `carrier:dpd` - DPD Labels

Pro Kontext:
1. "Drucker wählen" antippen
2. Netzwerk-Scan startet automatisch
3. Gefundene Drucker als Liste anzeigen
4. Antippen = zugewiesen

Gespeichert in AsyncStorage:
```typescript
interface PrinterConfig {
  context: string           // z.B. "carrier:dhl"
  printer: NetworkPrinter   // Name + Host + Port
}
```

### Druckflow

1. App bestimmt Kontext (z.B. `carrier:dhl` für DHL-Label, `doctype:lieferschein` für Lieferschein)
2. Nachschlagen welcher Drucker zugeordnet ist
3. PDF liegt bereits vor (Label von der API, oder Lieferschein vom Render-Endpoint)
4. PDF per IPP an `http://{host}:{port}/ipp/print` senden
5. IPP-Bibliothek: `ipp` npm package (pure JS, kein Native Module nötig - läuft über fetch/HTTP)

Fallback wenn kein Drucker konfiguriert: PDF zum Download anbieten / Share-Sheet öffnen.

## Backend-Änderungen

### Neuer Endpoint: PDF Render

`POST /api/mobile/print/render`

Request:
```json
{
  "templateId": 5,
  "orderId": 19470,
  "deliveryNoteId": 123,
  "paperWidth": 102
}
```

Response: `{ "success": true, "pdf": "<base64>" }`

Implementierung:
1. Template HTML aus `print_templates` laden
2. Variablen ersetzen (Firma, Kunde, Positionen, etc.)
3. Puppeteer rendert HTML → PDF mit `width: 102mm`, `height: auto`
4. PDF als Base64 zurückgeben

### Bestehende Endpoints (Mobile-Routen hinzufügen)

Die meisten Shipping-APIs existieren bereits. Mobile-Wrapper erstellen die den Device-Token Auth nutzen:

| Bestehend | Mobile-Route |
|-----------|-------------|
| `GET /api/versand/shipping/methods` | `GET /api/mobile/versand/shipping/methods` |
| `POST /api/versand/shipping/order/:id/labels` | `POST /api/mobile/versand/shipping/order/:id/labels` |
| `GET /api/versand/shipping/labels/:id/pdf` | `GET /api/mobile/versand/shipping/labels/:id/pdf` |
| `GET /api/versand/shipping/sender-address/:carrier` | `GET /api/mobile/versand/shipping/sender-address/:carrier` |
| `GET /api/druckvorlagen?type=X` | `GET /api/mobile/druckvorlagen?type=X` |
| `POST /api/versand/shipping/order/:id/complete` | Besteht bereits |
| `GET /api/delivery-notes/:id/render` | `POST /api/mobile/print/render` (neu) |

## Neue Dateien

### Mobile App

| Datei | Beschreibung |
|-------|-------------|
| `src/screens/VersandWizard.tsx` | Wizard-Container mit Step-Navigation, Header mit Zurück/Weiter |
| `src/screens/wizard/Step1Positionen.tsx` | Positionszuweisung, Mengenbearbeitung, Versandart |
| `src/screens/wizard/Step2Pakete.tsx` | Carrier-Wahl, Label-Erstellung, Gewicht |
| `src/screens/wizard/Step3Abschluss.tsx` | Zusammenfassung, Lieferschein, Ausliefern |
| `src/screens/wizard/StepProduktion.tsx` | Produktionsauftrag-Bestätigung |
| `src/lib/printer.ts` | mDNS Discovery + IPP Druck-Funktionen |
| `src/lib/api.ts` | Erweitern um Shipping/Label/Print API-Calls |

### Einstellungen erweitern

`src/screens/EinstellungenScreen.tsx` - neue Sektion "Drucker" mit Discovery + Kontext-Zuordnung.

### Backend

| Datei | Änderung |
|-------|---------|
| `src/routes/mobile.ts` | Neue Mobile-Routen für Shipping/Labels/Druckvorlagen |
| `src/services/pdfRenderer.ts` | Neuer Service: HTML-Template → PDF via Puppeteer |

## Abhängigkeiten (neue npm Packages)

**Mobile:**
- `react-native-zeroconf` - mDNS/Bonjour Discovery
- Kein IPP-Package nötig - IPP ist HTTP-basiert, wir bauen einen minimalen Client mit fetch

**Backend:**
- Puppeteer ist bereits installiert (wird für AB-OCR genutzt)

## Edge Cases

- **Kein Drucker konfiguriert:** PDF als Download/Share anbieten
- **Drucker offline:** Fehlermeldung + Retry-Button
- **Label-Erstellung fehlschlägt:** Fehler anzeigen, Retry möglich, Wizard bleibt auf Step 2
- **Teillieferung:** Nur zugewiesene Mengen werden fulfilled, Rest bleibt offen
- **Alle Positionen Skip:** Wizard schließen ohne Aktion
- **Nur EK-Liste/Produktion:** Step 2 (Pakete) wird übersprungen → direkt Step 3
