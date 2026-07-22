# Salsa Instruments

App web para apilar percusión y bajo de **salsa** y **mambo**: clave, congas, bongós, timbales, maracas, güiro, campana y bajo (tumbao anticipado). Controla BPM, swing, tap tempo, mute/solo y modo Practice (solo clave + conteo).

## Cómo correr

```bash
pnpm install
pnpm generate:samples   # regenera WAVs one-shot
pnpm dev
```

Abre la URL de Vite y pulsa **Play** (el navegador exige un gesto del usuario para desbloquear audio).

## Cómo suenan los instrumentos (gratis)

No hace falta ningún servicio de pago. El flujo es:

1. **One-shots** (golpes sueltos) en `public/samples/*.wav`.
2. El motor carga esos archivos con **Tone.js** (`Tone.Players`).
3. Un `Tone.Transport` global dispara cada golpe según patrones en steps de semicorchea (`src/data/instruments.ts`).
4. Al cambiar el BPM, todos los patrones se reescalan juntos.

### Origen de los samples

| Instrumento | Fuente |
|---|---|
| Clave, congas, bongós | [FreePats World Percussion](https://github.com/freepats/world-percussion) (CC0) |
| Maracas | [FreePats EggShaker](https://github.com/freepats/world-percussion) + bead synth (CC0) |
| Bajo | [Free Wave Samples](https://freewavesamples.com/) Roland JV-2080 Pick Bass (royalty-free) |
| Güiro | Ridge-scrape synth (`pnpm fetch:guiro`) |
| Campana | [VCSL Cowbells](https://github.com/sgossner/VCSL) (CC0) |
| Timbales, click | Síntesis propia (`pnpm generate:samples`) |

Para regenerar:

```bash
pnpm generate:samples   # base sintética
pnpm fetch:freepats     # clave/congas/bongós CC0
pnpm fetch:maracas      # maracas (EggShaker beads CC0)
pnpm fetch:guiro        # güiro (ridge scrapes)
pnpm fetch:campana      # campana metálica (TING / TAK)
pnpm fetch:bajo         # bajo eléctrico (Free Wave Samples)
```

Otras fuentes CC0 compatibles: [Freesound](https://freesound.org/) (filtro CC0), [VCSL Percussion](https://huggingface.co/datasets/schismaudio/vcsl-percussion).

Las ilustraciones en `public/images/` son SVG originales de este proyecto.

## Controles

| Control | Qué hace |
|---|---|
| Play / Pausa | Arranca o para el Transport |
| BPM | 80–200; rapidez del conteo |
| Tap Tempo | Detecta BPM con 2–4 toques |
| Swing | Swing ligero en corcheas |
| Clave 3-2 / 2-3 | Cambia el patrón de clave |
| Practice | Solo clave + click de conteo |
| Añadir | Capa el instrumento en el groove |
| Mute | Silencia sin quitarlo de la capa |
| Solo | Deja sonar solo ese instrumento |

## Stack

Vite · React · TypeScript · Tone.js · Zustand
