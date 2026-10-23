# ⚽ Mini Soccer Star Style

Juego móvil de fútbol de **un solo jugador** (controlas a tu futbolista; el resto del equipo lo mueve la IA), con cámara en perspectiva desde atrás, pases y tiros por gestos táctiles, modo carrera con ligas, objetivos, valoración individual, atributos, guardado local y audio 100 % sintetizado. Juego original: todo (campo, jugadores, escudos, sonidos) se genera por código; no hay recursos de terceros.

Tecnología: HTML5 + CSS3 + JavaScript (ES modules) + **Three.js 0.160** (partido en **3D real**, WebGL) + **Phaser 3.80.1** (bucle y escenas, en modo headless) + Web Audio API + LocalStorage. Vite sólo se usa como servidor de desarrollo y empaquetador.

## Requisitos
- Node.js 18 o superior (probado con Node 22) y npm.
- Un navegador moderno (Chrome/Android WebView, Safari, Firefox).

## Instalación y arranque
```bash
npm install
npm start          # servidor en http://localhost:5173 (también accesible desde el móvil por la IP de red)
```
Otros comandos:
```bash
npm run build      # genera dist/ (estático, rutas relativas)
npm run preview    # sirve dist/
npm test           # pruebas lógicas (física, guardado, carrera, valoración) + simulación de 2 partidos completos sin navegador
npm run test:e2e   # extremo a extremo en Chromium (requiere `npm i -D playwright` y `npm start` en marcha)
```

## Cómo se juega
| Control | Acción |
|---|---|
| **Joystick** (mitad izquierda, flotante) | Suave = toques cortos con el balón pegado · fuerte = carrera · hasta el borde = **sprint** (menos control, gasta resistencia) |
| **PASE** (arrastrar y soltar) | La dirección apunta al compañero (se ajusta al más cercano a tu gesto y se dibuja la trayectoria). Arrastre corto = pase corto, largo = pase largo, máximo = **pase filtrado** al espacio. Un toque = pase automático al mejor compañero |
| **TIRO** (arrastrar y soltar) | Flecha de dirección y barra de potencia. Corto = **colocado** (preciso), medio = normal, largo = **potente** (menos preciso). Un toque = tiro a puerta |
| **ALTO** | Activa pase/tiro elevado (globo, vaselina) |
| **De primera / cabeza** | Pulsa PASE o TIRO cuando el balón llega cerca de ti (con más riesgo de error); si viene alto, rematas de cabeza |
| **ENTRADA** (sin balón) | Entrada al rival con balón cercano o al balón suelto |
| **PRESIÓN** | Tus compañeros presionan 5 s (recarga 9 s) |
| **PEDIR** (cuando un compañero tiene el balón) | La IA te prioriza en sus pases durante 2 s |
| ❚❚ | Pausa (también se pausa sola al cambiar de pestaña/app) |

En ajustes hay **modo zurdo**. El **tutorial interactivo** (7 pasos: mover, esprintar, pasar, pedir, tirar, marcar, robar) se lanza desde el menú.

## Funcionalidades (estado)
**Completadas**
- Partido en 3D: campo texturizado con líneas reglamentarias, porterías con postes/larguero/red, banderines, bancos, publicidad ficticia, gradas con público, focos, sombras, futbolistas 3D con articulaciones y dorsal, indicador del jugador controlado y cámara en tercera persona que sigue balón + jugador con límites.
- Balón con física propia (altura, gravedad, fricción, rebotes, postes, larguero, red, goles sólo por la línea dentro del arco, saques de banda/puerta/esquina, balones aéreos, deflexiones al chocar con jugadores).
- Futbolistas dibujados por código con animaciones: caminar, correr, esprintar, conducir, pasar, disparar, cabecear/saltar, celebrar, caer/levantarse, entrada, defender (agachado), portero con estirada. Dorsal en la espalda.
- IA: compañeros (desmarques, espacios libres, apoyo, remates), defensas (marcaje, presión, entradas, despejes, errores ocasionales), porteros (posición, anticipación limitada, estiradas, atajar/rechazar, sacar). Dificultad Fácil/Normal/Difícil.
- Partido: marcador, cronómetro 0-90' (2/3/5 min reales), descanso, escenarios (partido completo, remontada, atacar con ventaja, final igualado), objetivos principales y secundarios, estadísticas, valoración 1-10 explicada, recompensas (XP y monedas).
- Carrera: creación del jugador (nombre, nacionalidad, posición, dorsal, aspecto, colores, club inicial), liga de 6 equipos ida y vuelta (10 jornadas) con clasificación, resultados simulados del resto de partidos, objetivos de temporada, ascenso/descenso, ofertas de traspaso y renovación de contrato, salarios, trofeos, historial.
- 12 atributos que afectan de verdad a la jugabilidad (velocidad, aceleración, regate, control, precisión de pase, potencia/precisión de tiro, definición, resistencia, equilibrio, posicionamiento, reacción) y mejora con XP con coste creciente.
- 14 pantallas (menú, creación, perfil, modos, carrera, calendario, previa, partido/HUD, pausa, resultados, fin de temporada, estadísticas, habilidades, historial/trofeos, ajustes, tutorial).
- Guardado automático versionado con validación; si está dañado el juego no se bloquea y se ofrece reiniciar con confirmación.
- Audio Web Audio: golpeo, pase, tiro, poste, parada, entrada, rebote, silbato, ambiente de estadio reactivo, celebración de gol, música de menú opcional; volumen por categoría y mute.
- Rendimiento: opción de reducir efectos y límite de 30/60 FPS, pausa automática, `touch-action: none`, sin dependencias no usadas.

**Decisiones y limitaciones conocidas**
- **Fútbol 7 (7 vs 7, 1-2-3-1)** en lugar de 11 vs 11: con 22 jugadores el campo vertical de un móvil queda demasiado saturado para controlar con precisión.
- No hay faltas, fueras de juego, tarjetas ni penaltis; las entradas fallidas o exitosas hacen caer al jugador sin pitar falta.
- Los demás partidos de la liga se simulan estadísticamente a partir de la valoración de los clubes (el tuyo siempre se juega).
- El tope de FPS se aplica limitando la frecuencia de actualización/dibujo de la escena (no el bucle de Phaser).
- Gráficos 3D y sonidos procedurales (primitivas, sin modelos ni texturas externas): sencillos a propósito. Sin sombras en tiempo real (sombras de mancha) para cuidar el rendimiento móvil.
- **Sólo se ha probado en Chromium de escritorio sin interfaz** (Playwright, viewport móvil, render por software) y con simulaciones en Node. **No se ha probado en un dispositivo Android real**, así que el rendimiento en gama baja no está verificado (en la prueba, el coste de CPU por fotograma fue ≈ 2 ms).
- El saque de banda/esquina del jugador espera su gesto (si no actúas en ~4,5 s, la IA lo saca por ti).

## Probar en Android
1. Conecta el móvil a la misma red Wi-Fi y ejecuta `npm start`.
2. Abre en Chrome del móvil `http://IP_DEL_PC:5173` (la URL aparece como *Network* en la terminal).
3. Opcional: menú ⋮ de Chrome → *Añadir a pantalla de inicio*. Para depurar: `chrome://inspect` desde Chrome de escritorio con el móvil por USB.

## Empaquetar como APK (Capacitor)
Requiere Android Studio (SDK + JDK 17).
```bash
npm run build
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap add android          # usa capacitor.config.json (webDir: dist)
npx cap sync android
npx cap open android         # Android Studio → Build > Build Bundle(s)/APK(s) > Build APK(s)
```
Para bloquear la orientación vertical añade `android:screenOrientation="portrait"` a la actividad en `android/app/src/main/AndroidManifest.xml` (opcional: el juego también funciona en horizontal). Cambia `appId` en `capacitor.config.json` antes de publicar. Tras cada cambio del código: `npm run build && npx cap sync android`.

## Estructura
```
index.html            punto de entrada
styles/main.css       interfaz, HUD y controles táctiles
capacitor.config.json configuración para el APK
src/
  main.js             arranque de Phaser y flujo de la aplicación (menús ⇄ partido ⇄ resultados)
  config.js  data.js  util.js   constantes, clubes/objetivos/escenarios, utilidades
  scenes/             BootScene, MatchScene (bucle del partido, cámara, trayectoria de gestos, tutorial)
  entities/Player.js  datos del futbolista (el balón y el portero viven en BallPhysics y AIManager)
  systems/
    MatchManager.js   reglas, posesión, golpeos, entradas, restos, objetivos, estadísticas, valoración
    BallPhysics.js    física pura del balón (sin Phaser, probada en Node)
    AIManager.js      compañeros, defensas y porteros
    TouchControls.js  joystick y botones con gestos (DOM + Pointer Events)
    CareerManager.js  temporadas, liga, fichajes, contratos, trofeos
    ProgressionManager.js  atributos, XP, valoración 1-10
    SaveManager.js    guardado versionado y validado
    AudioManager.js   audio sintetizado
  render/             Camera (foco y seguimiento), Stage3D (escena Three.js: campo, gradas, jugadores, balón, efectos)
  ui/                 HUD, Menus (pantallas), MatchResults, avatar (SVG)
tests/                logic.test.mjs, sim.mjs, e2e.mjs
```
