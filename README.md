# Salsa Instruments

App web para apilar percusión y bajo de **salsa** y **mambo**: clave, congas, bongós, timbales, maracas, güiro, campana y bajo (tumbao anticipado). Controla BPM, swing, Sync Tempo, mute/solo, Negras (click del pulso encima) y Mute all.

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
| Clave, conga (mute) | [FreePats World Percussion](https://github.com/freepats/world-percussion) (CC0) |
| Congas (open/slap), bongós, timbales, maracas | [VCSL](https://github.com/sgossner/VCSL) — grabaciones reales (CC0) |
| Güiro | [Freesound CC0](https://freesound.org/) — brunoboselli / SamuelGremaud |
| Campana | [VCSL Cowbells](https://github.com/sgossner/VCSL) (CC0) |
| Bajo | [Free Wave Samples](https://freewavesamples.com/) Roland JV-2080 Pick Bass (royalty-free) |
| Click | Síntesis propia (`pnpm generate:samples`) |

Para regenerar:

```bash
pnpm generate:samples   # click + fallbacks sintéticos
pnpm fetch:freepats     # clave + conga mute (CC0)
pnpm fetch:vcsl         # congas/bongós/timbales/maracas reales (CC0)
pnpm fetch:guiro        # güiro (raspados reales CC0)
pnpm fetch:campana      # campana metálica (TING / TAK)
pnpm fetch:bajo         # bajo eléctrico (Free Wave Samples)
```

Otras fuentes CC0 compatibles: [Freesound](https://freesound.org/) (filtro CC0), [VCSL Percussion](https://huggingface.co/datasets/schismaudio/vcsl-percussion).

Las ilustraciones en `public/images/` son SVG originales de este proyecto.

## Controles

| Control | Qué hace |
|---|---|
| Play / Pausa | Arranca o para el Transport |
| BPM | 80–260; rapidez del conteo |
| Sync Tempo | Detecta BPM con 2–4 toques |
| Swing | Swing ligero en corcheas |
| Clave → Son / Rumba | En la tarjeta Clave: elige 2-3 o 3-2 (mueve también cáscara, mambo…) |
| Negras | Añade el click de las negras (1–8) encima del groove |
| Mute all | Silencia todos los instrumentos (Negras sigue si está ON) |
| Capa (switch) | Añade o quita el instrumento del groove |
| Solo | Deja sonar solo ese instrumento |

## Offline / PWA

Tras la **primera visita online**, el service worker cachea JS, CSS, fuentes locales, iconos y todos los samples (~1.4 MB). Después puedes usarla **sin red**.

En el móvil: “Añadir a pantalla de inicio” / Install. En desktop Chrome: icono de instalar en la barra de direcciones.

## Stack

Vite · React · TypeScript · Tone.js · Zustand · vite-plugin-pwa
