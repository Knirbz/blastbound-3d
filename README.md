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
- Auf Smartphones: linken Daumen auf dem runden Pad bewegen; die rechte Hälfte der Spiel- und Steuerfläche antippen, um eine Bombe zu legen

Im laufenden Spiel verhindern das Spielfeld und die Touchsteuerung Browser-Zoomgesten. Hauptmenü und Startauswahl füllen auf Mobilgeräten den Bildschirm.

Halte eine Richtung gedrückt, um dich frei zwischen den Feldern zu bewegen. Zwei Richtungen gleichzeitig ergeben eine diagonale Bewegung. Wände, Kisten und Bomben blockieren die Figur direkt an ihrer Kante; Explosionen können sie auch treffen, wenn sie nur teilweise in einem betroffenen Feld steht. Bomben werden auf dem nächstgelegenen Feld platziert.

Das Hauptmenü bietet **Gegen CPU**, **Lobby erstellen**, **Lobby beitreten** und **Optionen**. Gegen CPU führt zur Auswahl einer von sechs Kenney-Figuren, des Bot-Modus **Training**, **Leicht**, **Mittel** oder **Schwer** und einer Karte. Die Auswahl wird im Browser gespeichert. Im Training stehen die Bots still und greifen nicht an. In den anderen Modi bewegen sie sich und legen eigene Bomben; sie blockieren damit keine Bombenplätze des Spielers. Schwere Bots suchen Wege um feste Blöcke herum. Über das Pausemenü oder nach einer Runde geht es zurück ins Hauptmenü.

**Lobby erstellen** legt einen echten Online-Raum mit sechsstelligen Code an. Mit **Einladung teilen** verschickst du den Code und einen direkten Beitrittslink. **Lobby beitreten** akzeptiert beides; über den Link ist der Code vorausgefüllt. Bis zu acht Spieler können dieselbe kompakte 7 × 7-Arena betreten, einander mit den vorhandenen 3D-Figuren sehen, Bomben legen und zufällig erscheinende Upgrades sammeln. Drei Upgrades liegen zum Start bereit, danach erscheint etwa alle 4,5 Sekunden ein weiteres, solange weniger als fünf auf dem Feld sind. Bombentreffer beenden die freie Runde nicht. Ein Raum läuft nach 24 Stunden ab. Im Menü **Optionen** lassen sich Ton und Renderauflösung einstellen.

Der **Burghof** bleibt die klassische Karte mit Kenney-Holzobjekten. Die **Werkhalle** verwendet dunkle, feste Metallblöcke und leuchtend orange zerstörbare Energiecontainer. Auf zwei markierten Förderbahnen fahren dort gelegte Bomben alle 0,55 Sekunden ein Feld weiter, bis sie am Ende oder vor einer anderen Bombe stehen bleiben. Der Zünder läuft währenddessen weiter.

**Kassenchaos** ist eine dritte Arena mit den Originalmodellen aus Kenneys `Mini Market`: Marktfliesen, Säulen, Regale, Kühltruhen, Obst- und Brotauslagen sowie Kassen. Die grüngrau abgedunkelten Marktfliesen lassen die hellen zerstörbaren Objekte klar hervortreten. Zwei freie Kassenbahnen nehmen gelegte Bomben in Einkaufswagen auf und fahren sie ebenfalls alle 0,55 Sekunden feldweise weiter. Die Bomben können an den Enden oder vor einer anderen Bombe stoppen, während der Zünder weiterläuft. Die ein Feld breiten Gänge und die kreuzförmigen Explosionen bleiben erhalten.

**Spukfriedhof** ist die vierte Arena mit Modellen aus Kenneys `Graveyard Kit`: Steinmauern und Gruften sind fest; Särge und Kürbisse können gesprengt werden. Zwei freie Spukgräber mit Geistern bilden ein Paar. Eine Bombe, die auf einem der Gräber liegt, erscheint sofort auf dem anderen, sofern dieses frei ist. Ihr Zünder läuft weiter. Ist das Ziel belegt, wartet die Bombe am Eingang und wird transportiert, sobald das Ziel frei wird. Auch geschobene und geworfene Bomben können so den Ort wechseln. Der Boden verwendet ein Originalmodell aus Kenneys `Fantasy Town Kit`.

**Kanonenbucht** ist die fünfte Arena mit den Originalmodellen aus Kenneys `Pirate Kit`: Festungsmauern, Felsen, Kanonen, Kisten und Fässer. Ein durchgehendes Holzdeck aus Kenneys `Fantasy Town Kit` verbindet die Felder. Zwei feste Küstenkanonen feuern abwechselnd entlang freier Gänge. Vor jedem Schuss zeigen Leuchtsignale auf der Bahn und ein Hinweis im Spiel an, welche Reihe gefährlich wird. Die Kanonenkugel verletzt Figuren und kann eine Bombe als Kettenreaktion zünden. Das Labyrinth bleibt auf dem klassischen 13 × 11-Raster.

Besiege alle drei Gegner und sprenge das Portal frei. Danach betritt das Portal, um zu gewinnen. Die Grundreichweite beträgt ein Feld pro Richtung. Sieben eigenständige 3D-Bombenmodelle haben eigene Körperformen und Grundfarben: klassische dunkle Kugel, hoher blauer Feuerkraftbehälter, goldener Powerblock, rote Stachel-Superbombe, violetter Funkzünder, grüner Schleimkörper und pinke Gegnerbombe. Jede Bombe warnt kurz vor der Explosion mit Licht, Ring und leichtem Zittern. Normale Explosionen sind orange, stärkere türkis und Kettenreaktionen violett.

Kisten und Fässer können die klassischen Items aus dem [Handbuch zu **Super Bomberman 2**](https://www.world-of-nintendo.com/manuals/super_nes/super_bomberman_2.shtml) enthalten: Extra-Feuerkraft, Extra-Bombe, Skates, Fernzünder, Bombenpass, Blockpass, Power-Handschuh, Bomben-Kick, Herz, maximale Feuerkraft, Power-Bombe, Superbombe, Schleimbombe und Schädel. Ein zusätzlicher Schild bleibt als Blastbound-Item erhalten. Der Handschuh nimmt eine nahe Bombe mit **R** auf und wirft sie mit erneutem **R** in Blickrichtung. Ein Kick schiebt Bomben feldweise; mit **R** hältst du sie an. Schleimbomben prallen beim Schieben oder Werfen von Hindernissen ab. Der Schädel verursacht für acht Sekunden einen zufälligen Nachteil; ein anderes Item hebt ihn auf. Die aktiven Fähigkeiten werden im Spiel eingeblendet. Auf Mobilgeräten erscheint für Spezialaktionen eine zweite Schaltfläche.

Die Sammelobjekte zeigen die vorhandenen Bildsymbole nun deutlich größer als schwebende, zur Kamera ausgerichtete 3D-Marker. So bleiben sie auch auf kleinen Displays lesbar. Ihr Stil orientiert sich an den klassischen Items und an [Super Bomberman R 2](https://www.konami.com/games/bomberman/r2/eu/de/battle/).

## Prüfen

```sh
npm test
npm run build
```

## Veröffentlichung

- Quellcode: https://github.com/Knirbz/blastbound-3d
- Spiel: https://blastbound-3d.pages.dev
- Lobby-Dienst: https://blastbound-lobby.4r65rwknfp.workers.dev

Die Seite wird auf Cloudflare Pages per Direct Upload veröffentlicht. Der Lobby-Dienst läuft als Cloudflare Worker mit Durable Objects. Das GitHub-Repository enthält den Quellcode; ein Push allein veröffentlicht noch keine neue Version. Nach Änderungen:

```sh
npm ci
npm test
npm run build
```

Für die Veröffentlichung aus PowerShell:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = '8a7e885c48e5eaaa7f46e9a9480eefdd'
npx wrangler deploy --config worker/wrangler.jsonc
npx wrangler pages deploy dist --project-name blastbound-3d --branch main
```

Dafür ist eine lokale Cloudflare-Anmeldung mit `npx wrangler login` erforderlich. Ein GitHub-Secret wird nicht benötigt. Die öffentliche Worker-Adresse steht in `.env.production`. `npm run dev` nutzt dieselbe Adresse aus `.env.development`. Ein getrennter lokaler Worker lässt sich grundsätzlich mit `npx wrangler dev --config worker/wrangler.jsonc --port 8787` starten; auf diesem Windows-Rechner antwortete dessen lokales Durable Object jedoch mit einem internen Wrangler-Fehler, während die veröffentlichte Version funktioniert. Den Online-Raum kann man mit `node tools/smoke-lobby.mjs https://blastbound-lobby.4r65rwknfp.workers.dev` prüfen. Node.js 22 ist in `.node-version` festgelegt.

## 3D-Assets

Die animierten Figuren stammen aus den Kenney-Paketen `Mini Characters` und `Mini Arena`. Die festen türkis getönten Mauerblöcke nutzen ein Modell aus [Mini Arena](https://kenney.nl/assets/mini-arena). Holzgerüste, Fässer und die Portaltruhe stammen aus [Mini Dungeon](https://kenney.nl/assets/mini-dungeon). Ihre GLB-Dateien und Farbtexturen liegen unter `public/assets/kenney/`; die jeweiligen CC0-Lizenzen liegen daneben. Die Modelle werden im Spiel skaliert. Bei einem Ladefehler bleiben Three.js-Formen als technische Rückfallebene nutzbar.

Die sechs auswählbaren Figuren und ihre Vorschauen wurden aus dem [offiziellen Mini-Characters-Paket](https://kenney.nl/assets/mini-characters) übernommen. Die Vorschaubilder liegen unter `public/assets/kenney/characters/previews/`. Aus dem [Kenney Particle Pack](https://kenney.nl/assets/particle-pack) stammen ausgewählte transparente Texturen für Flammen, Funken, Rauch, Brandspuren und Bodenabnutzung. Nur die tatsächlich verwendeten Dateien liegen unter `public/assets/kenney/particles/`, zusammen mit der CC0-Lizenz.

Die Marktobjekte kommen aus dem vom Nutzer bereitgestellten Archiv `kenney_mini-market.zip`. Die unveränderten GLB-Dateien, ihre Farbtextur und die CC0-Lizenz liegen unter `public/assets/kenney/market/`.

Die Friedhofsobjekte kommen aus dem vom Nutzer bereitgestellten Archiv `kenney_graveyard-kit_5.0.zip`; die Bodenfliese aus dem ebenfalls bereitgestellten `kenney_fantasy-town-kit_2.0.zip`. Ihre GLB-Dateien, Farbtexturen und CC0-Lizenzen liegen unter `public/assets/kenney/graveyard/`. Beleuchtung und Skalierung der Modelle passen zur festen Spielkamera.

Die Hafenobjekte und die fliegende Kanonenkugel kommen aus dem vom Nutzer bereitgestellten Archiv `kenney_pirate-kit.zip`. Der durchgehende Boden stammt aus `kenney_fantasy-town-kit_2.0.zip`. Die benötigten GLB-Dateien, Farbtexturen und CC0-Lizenzen liegen unter `public/assets/kenney/pirate/`.

Die sieben eigens für Blastbound modellierten Bomben liegen als GLB-Dateien unter `public/assets/blastbound/bombs/`. Ihr Quellgenerator ist `tools/create-bomb-assets.mjs`; im Spiel werden die fertigen Modelle geladen und mit Zünder, Leuchtring und Warnsignal animiert.

Die Mini-Arena-Mauerblöcke markieren unzerstörbare Felder. Holzgerüste und Fässer sind zerstörbar; die Truhe verdeckt das Portal. Das Holzgerüst erhält einen einfachen Füllkörper, damit seine Kollisionsfläche aus der Spielkamera erkennbar ist. Die Explosion zeigt die gefährlichen Felder sofort an. Ein kurzer Zündblitz und Licht auf den Nachbarblöcken gehen in ein breites, flackerndes Feuerkreuz über. Funken, Rauch und Brandspuren klingen danach ab. Stärkere Bomben erzeugen türkisfarbenes Feuer mit einem Impulsring am Zündpunkt; Kettenreaktionen leuchten violett und knistern.

Der beige Block aus `Mini Arena` hebt sich farblich kaum von zerstörbaren Objekten ab; deshalb nutzt das Spiel dessen gemauerte Wandform in Türkis. Die hohen Wände des [Modular Dungeon Kit](https://kenney.nl/assets/modular-dungeon-kit) würden die ein Feld breiten Wege aus der festen Kameraperspektive verdecken. [Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) enthält 2D-Pixelgrafik und passt nicht zu den 3D-Hindernissen.
