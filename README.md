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

Besiege alle drei Gegner und sprenge das Portal frei. Danach betritt das Portal, um zu gewinnen. Kisten können Upgrades für Flammenreichweite und Bombenkapazität enthalten.

## Prüfen

```sh
npm test
npm run build
```

## Cloudflare Pages

Dieses Repository ist für Cloudflare Pages mit GitHub-Anbindung vorbereitet. Einstellungen:

- Produktionszweig: `main`
- Build-Befehl: `npm run build`
- Ausgabeordner: `dist`
- Node.js: 22 (`.node-version`)

Nach der GitHub-Anbindung erstellt Cloudflare Pages bei jedem Push auf `main` einen neuen Produktions-Build.
