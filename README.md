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
