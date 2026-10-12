# Blastbound 3D

Ein spielbares Bomberman-inspiriertes 2,5D-Browsergame mit Three.js, TypeScript und Vite. Die Spiellogik läuft auf einem festen 13 × 11-Raster; Three.js rendert Figuren, Kisten, Wände, Bomben und Effekte als 3D-Meshes.

## Lokal starten

```sh
npm ci
npm run dev
```

## Bedienung

- **WASD** oder **Pfeiltasten**: bewegen
- **Leertaste**: Bombe legen
- **P** oder **Escape**: Pause
- Auf Smartphones: Bildschirmtasten für Bewegung und Bombe

Vor dem Start kannst du eine von sechs Kenney-Figuren auswählen. Die Auswahl wird im Browser gespeichert und beim nächsten Besuch wiederhergestellt.

Besiege alle drei Gegner und sprenge das Portal frei. Danach betritt das Portal, um zu gewinnen. Kisten können Upgrades für Flammenreichweite und Bombenkapazität enthalten.

## Prüfen

```sh
npm test
npm run build
```

## Veröffentlichung

- Quellcode: https://github.com/Knirbz/blastbound-3d
- Spiel: https://blastbound-3d.pages.dev

Die Seite wird auf Cloudflare Pages per Direct Upload veröffentlicht. Das GitHub-Repository enthält den Quellcode; ein Push allein veröffentlicht noch keine neue Version. Nach Änderungen:

```sh
npm ci
npm test
npm run build
```

Für die Veröffentlichung aus PowerShell:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = '8a7e885c48e5eaaa7f46e9a9480eefdd'
npx wrangler pages deploy dist --project-name blastbound-3d --branch main
```

Dafür ist eine lokale Cloudflare-Anmeldung mit `npx wrangler login` erforderlich. Ein GitHub-Secret wird nicht benötigt. Node.js 22 ist in `.node-version` festgelegt.

## 3D-Assets

Die animierten Figuren stammen aus den vom Nutzer bereitgestellten Kenney-Archiven `kenney_mini-characters.zip` (Version 1.0) und `kenney_mini-arena.zip` (Version 1.1). Die verwendeten GLB-Dateien und ihre externen Farbtexturen liegen unverändert unter `public/assets/kenney/`; ihre jeweiligen CC0-Lizenzdateien liegen daneben. Im Spiel werden die Modelle nur einheitlich skaliert. Bei einem Ladefehler bleiben die ursprünglichen Three.js-Figuren als technische Rückfallebene nutzbar.

Die sechs auswählbaren Figuren und ihre Vorschauen wurden aus dem [offiziellen Mini-Characters-Paket](https://kenney.nl/assets/mini-characters) übernommen. Die Vorschaubilder liegen unter `public/assets/kenney/characters/previews/`.

Der beige Steinblock aus Mini Arena wurde im Spiel getestet, aber Kisten und unzerstörbare Mauern waren damit schwer zu unterscheiden. Die vorhandenen kontrastreichen Three.js-Mauern und Kisten bleiben vorerst im Einsatz, bis passende eigenständige 3D-Assets vorliegen.

`kenney_modular-dungeon-kit_1.0.zip` wurde geprüft, aber seine hohen Korridorwände würden die ein Feld breiten Wege aus der festen Kameraperspektive verdecken. `kenney_tiny-dungeon.zip` enthält 2D-Pixelgrafik und wird daher nicht als Ersatz für 3D-Figuren verwendet.
