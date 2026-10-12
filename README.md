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
- Auf Smartphones: D-Pad gedrückt halten und den Daumen für Richtungswechsel oder diagonale Bewegung ziehen; separater Bombenknopf

Im laufenden Spiel verhindern das Spielfeld und die Touchsteuerung Browser-Zoomgesten. Der Startbildschirm bleibt auf kleinen Geräten scrollbar, falls er nicht vollständig in die verfügbare Höhe passt.

Halte eine Richtung gedrückt, um dich frei zwischen den Feldern zu bewegen. Zwei Richtungen gleichzeitig ergeben eine diagonale Bewegung. Wände, Kisten und Bomben blockieren die Figur direkt an ihrer Kante; Explosionen können sie auch treffen, wenn sie nur teilweise in einem betroffenen Feld steht. Bomben werden auf dem nächstgelegenen Feld platziert.

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

Die animierten Figuren stammen aus den Kenney-Paketen `Mini Characters` und `Mini Arena`. Die festen Steinblöcke sowie die zerstörbaren Holzgerüste, Fässer und die Portaltruhe stammen aus dem [Kenney-Paket Mini Dungeon](https://kenney.nl/assets/mini-dungeon). Ihre GLB-Dateien und Farbtexturen liegen unter `public/assets/kenney/`; die jeweiligen CC0-Lizenzen liegen daneben. Die Modelle werden im Spiel skaliert. Bei einem Ladefehler bleiben die ursprünglichen Three.js-Formen als technische Rückfallebene nutzbar.

Die sechs auswählbaren Figuren und ihre Vorschauen wurden aus dem [offiziellen Mini-Characters-Paket](https://kenney.nl/assets/mini-characters) übernommen. Die Vorschaubilder liegen unter `public/assets/kenney/characters/previews/`.

Die Mini-Dungeon-Steinblöcke markieren unzerstörbare Felder. Holzgerüste und Fässer sind zerstörbar; die Truhe verdeckt das Portal. Das Holzgerüst erhält einen einfachen Füllkörper, damit seine Kollisionsfläche aus der Spielkamera erkennbar ist.

`Mini Arena` bietet einen beigen Steinblock, der sich farblich kaum von zerstörbaren Objekten abhebt. Die hohen Wände des [Modular Dungeon Kit](https://kenney.nl/assets/modular-dungeon-kit) würden die ein Feld breiten Wege aus der festen Kameraperspektive verdecken. [Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) enthält 2D-Pixelgrafik und passt nicht zu den 3D-Hindernissen.
