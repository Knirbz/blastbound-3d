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
- **R**: Fernzünder, Bombe mit Handschuh aufnehmen/werfen oder gekickte Bombe stoppen
- **P** oder **Escape**: Pause
- Auf Smartphones: D-Pad gedrückt halten und den Daumen für Richtungswechsel oder diagonale Bewegung ziehen; separater Bombenknopf

Im laufenden Spiel verhindern das Spielfeld und die Touchsteuerung Browser-Zoomgesten. Der Startbildschirm bleibt auf kleinen Geräten scrollbar, falls er nicht vollständig in die verfügbare Höhe passt.

Halte eine Richtung gedrückt, um dich frei zwischen den Feldern zu bewegen. Zwei Richtungen gleichzeitig ergeben eine diagonale Bewegung. Wände, Kisten und Bomben blockieren die Figur direkt an ihrer Kante; Explosionen können sie auch treffen, wenn sie nur teilweise in einem betroffenen Feld steht. Bomben werden auf dem nächstgelegenen Feld platziert.

Vor dem Start kannst du eine von sechs Kenney-Figuren und den Bot-Modus **Training**, **Leicht**, **Mittel** oder **Schwer** auswählen. Beide Einstellungen werden im Browser gespeichert. Im Training stehen die Bots still und greifen nicht an. In den anderen Modi bewegen sie sich und legen eigene Bomben; sie blockieren damit keine Bombenplätze des Spielers. Schwere Bots suchen Wege um feste Blöcke herum. Über das Pausemenü oder nach einer Runde führt „Figur / Modus ändern“ zurück zur Auswahl.

Besiege alle drei Gegner und sprenge das Portal frei. Danach betritt das Portal, um zu gewinnen. Die Grundreichweite beträgt ein Feld pro Richtung. Die Bombe hat einen sichtbar abbrennenden Zünder, bleibt nach dem Legen ruhig und warnt erst kurz vor der Explosion mit Licht, Ring und leichtem Zittern. Fernzündbare, durchschlagende und Schleimbomben haben eigene Farben. Bot-Bomben sind rosa; normale Explosionen sind orange, stärkere türkis und Kettenreaktionen violett.

Kisten und Fässer können die klassischen Items aus dem [Handbuch zu **Super Bomberman 2**](https://www.world-of-nintendo.com/manuals/super_nes/super_bomberman_2.shtml) enthalten: Extra-Feuerkraft, Extra-Bombe, Skates, Fernzünder, Bombenpass, Blockpass, Power-Handschuh, Bomben-Kick, Herz, maximale Feuerkraft, Power-Bombe, Superbombe, Schleimbombe und Schädel. Ein zusätzlicher Schild bleibt als Blastbound-Item erhalten. Der Handschuh nimmt eine nahe Bombe mit **R** auf und wirft sie mit erneutem **R** in Blickrichtung. Ein Kick schiebt Bomben feldweise; mit **R** hältst du sie an. Schleimbomben prallen beim Schieben oder Werfen von Hindernissen ab. Der Schädel verursacht für acht Sekunden einen zufälligen Nachteil; ein anderes Item hebt ihn auf. Die aktiven Fähigkeiten werden im Spiel eingeblendet. Auf Mobilgeräten erscheint für Spezialaktionen eine zweite Schaltfläche.

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

Die animierten Figuren stammen aus den Kenney-Paketen `Mini Characters` und `Mini Arena`. Die festen türkis getönten Mauerblöcke nutzen ein Modell aus [Mini Arena](https://kenney.nl/assets/mini-arena). Holzgerüste, Fässer und die Portaltruhe stammen aus [Mini Dungeon](https://kenney.nl/assets/mini-dungeon). Ihre GLB-Dateien und Farbtexturen liegen unter `public/assets/kenney/`; die jeweiligen CC0-Lizenzen liegen daneben. Die Modelle werden im Spiel skaliert. Bei einem Ladefehler bleiben Three.js-Formen als technische Rückfallebene nutzbar.

Die sechs auswählbaren Figuren und ihre Vorschauen wurden aus dem [offiziellen Mini-Characters-Paket](https://kenney.nl/assets/mini-characters) übernommen. Die Vorschaubilder liegen unter `public/assets/kenney/characters/previews/`. Aus dem [Kenney Particle Pack](https://kenney.nl/assets/particle-pack) stammen ausgewählte transparente Texturen für Flammen, Funken, Rauch, Brandspuren und Bodenabnutzung. Nur die tatsächlich verwendeten Dateien liegen unter `public/assets/kenney/particles/`, zusammen mit der CC0-Lizenz.

Die Mini-Arena-Mauerblöcke markieren unzerstörbare Felder. Holzgerüste und Fässer sind zerstörbar; die Truhe verdeckt das Portal. Das Holzgerüst erhält einen einfachen Füllkörper, damit seine Kollisionsfläche aus der Spielkamera erkennbar ist. Bomben, Upgrades und Explosionen werden als animierte Three.js-Objekte gerendert. Die Explosion zeigt die gefährlichen Felder sofort an. Ein kurzer Zündblitz und Licht auf den Nachbarblöcken gehen in ein breites, flackerndes Feuerkreuz über. Funken, Rauch und Brandspuren klingen danach ab. Stärkere Bomben erzeugen türkisfarbenes Feuer mit einem Impulsring am Zündpunkt; Kettenreaktionen leuchten violett und knistern.

Der beige Block aus `Mini Arena` hebt sich farblich kaum von zerstörbaren Objekten ab; deshalb nutzt das Spiel dessen gemauerte Wandform in Türkis. Die hohen Wände des [Modular Dungeon Kit](https://kenney.nl/assets/modular-dungeon-kit) würden die ein Feld breiten Wege aus der festen Kameraperspektive verdecken. [Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) enthält 2D-Pixelgrafik und passt nicht zu den 3D-Hindernissen.
