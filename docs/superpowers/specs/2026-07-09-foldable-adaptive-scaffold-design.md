# Foldable-Grundgerüst: Adaptive Navigation (Honor V6 / breite Fenster)

**Datum:** 2026-07-09
**Betrifft:** HANDY-Kotlin-App (`android/HANDY/`) — die einzige ausgelieferte App

## Ziel

Die App soll auf dem aufgeklappten Honor V6 (und jedem breiten Fenster) den Platz
sinnvoll nutzen: Menü als feste, **wegklappbare Sidebar links**, Inhalt daneben.
Zugeklappt / auf normalen Handys bleibt alles exakt wie heute.

## Entscheidung: Eine APK, Window Size Classes

- **Keine separate Foldable-APK.** Eine App, ein Auto-Updater, ein Release-Prozess.
- **Kein „responsive" Skalieren.** Stattdessen zwei getrennte, handgebaute
  Layout-Varianten pro Navigations-Gerüst, ausgewählt über die **Fensterbreite**
  (Window Size Class), nicht über das Gerätemodell:
  - `COMPACT` (< 600dp: Handy, zugeklapptes V6, Splitscreen): heutiges Layout,
    `ModalNavigationDrawer` über dem Inhalt.
  - `MEDIUM`/`EXPANDED` (≥ 600dp: aufgeklapptes V6, Tablet, Handy quer):
    permanente Sidebar links (~300dp), per Hamburger-Button komplett
    ein-/ausklappbar. Inhalt nutzt die volle Restbreite.
- Fensterbreite statt Gerät: Klappt man das V6 zu oder zieht die App in den
  Splitscreen, wechselt das Layout automatisch zurück auf die Handy-Variante.

## Umsetzung (Phase 1 — dieses Release)

1. **`AndroidManifest.xml`**: `android:screenOrientation="portrait"` entfernen —
   die Sperre macht die App aufgeklappt unbrauchbar.
2. **`build.gradle.kts`**: `androidx.compose.material3.adaptive:adaptive` ergänzen
   (liefert `currentWindowAdaptiveInfo()`; Basis für spätere
   `ListDetailPaneScaffold`-Phase).
3. **`MainScaffold.kt`**: Breiten-Weiche.
   - Sichtbarkeits-Zustand der Sidebar prozessweit halten (Objekt mit
     `mutableStateOf`), damit er beim Navigieren zwischen Haupt-Screens erhalten
     bleibt.
   - Breit: `Row { Sidebar (AnimatedVisibility) | Content-Scaffold }`,
     Hamburger toggelt Sidebar statt Drawer zu öffnen. Menü-Auswahl schließt die
     Sidebar nicht.
   - Schmal: bestehender `ModalNavigationDrawer` unverändert.
4. **Update-Banner** bleibt im Content-Bereich (beide Varianten).

Detail-Screens (Auftrag, Rechnung, …) bleiben in Phase 1 Vollbild mit
Zurück-Pfeil.

## Spätere Phasen (nicht Teil dieses Releases)

- **Phase 2:** Liste-Detail-Zweispalter (Aufträge, Verkauf zuerst) via
  `ListDetailPaneScaffold`.
- **Phase 3:** Auslieferungs-/Strecken-Flow funktional: Admin-API-Proxy für
  `POST /api/shopping-list/create-orders` + Auslöse-UI (Preview → Bestellen)
  in der Einkaufsliste. Deadline-relevant: Urlaub ab 18.07.2026.

## Test

- Build `assembleDebug`/`assembleRelease` grün.
- Manuell auf dem V6: zugeklappt unverändert; aufgeklappt Sidebar sichtbar,
  wegklappbar, Navigation funktioniert; Auf-/Zuklappen wechselt das Layout ohne
  Zustandsverlust.
