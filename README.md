# CamSoccer · Broadcast Club

Un juego arcade de retransmisión futbolística: no controlas a los jugadores, sino la cámara que ve la audiencia. Busca la jugada, mantén el encuadre, consigue Planos de oro y corta a repetición en el momento exacto.

## Contenido

- **Práctica libre en la portada:** cámara y modelos reales del juego, sin reloj, audiencia ni puntuación. Incluye 22 jugadores, dos porteros, balón, perro, mascota, dron y entrenador, con destinos rápidos para cada sujeto.
- **Carrera:** 5 estadios con dificultad, incidentes y objetivos progresivos.
- **Copa Broadcast:** clasificatorio, semifinal y final encadenados; el bronce permite avanzar.
- **Arcade:** 3 desafíos cortos con más ritmo, más incidentes y puntuación ×1,15.
- Simulación de 22 futbolistas con pases, centros, regates, robos, disparos, paradas, faltas y goles.
- Ocho incidentes animados: perro, intruso, pelea, entrenador, mascota, dron, aspersores y bengala. El perro tiene pelaje, collar y cuatro patas articuladas, con tamaño ajustado y orientación siempre derecha; el entrenador tiene abrigo, cara roja de enfado, pelo gris, carpeta táctica y gestos propios.
- Gradas con asientos y espectadores persistentes, bufandas, olas y protestas. La ocupación reproduce la audiencia real: al perderla quedan asientos vacíos y se escuchan oleadas de abucheos; al recuperarla vuelve el público.
- Entradas y salidas suaves, avisos de expiración y eventos capturados diferenciados en el mapa.
- Zoom 1×–2×, joystick táctil, mapa multipointer, teclado y repeticiones con cargas regenerables.
- Medallas, récords, XP, niveles de director, monedas y tres líneas de mejoras permanentes.
- Sonido sintetizado local, incluidos abucheos de multitud con varias voces y ruido filtrado. Se detiene al silenciar, pausar o salir; vibración opcional, pausa automática al ocultar la app y soporte del botón Atrás de Android.
- Interfaz responsive para retrato, paisaje, tablet y escritorio. Sin anuncios, compras ni servicios externos.

## Equilibrio y modos

La dificultad está definida en `src/levels.ts` y modifica audiencia inicial, pérdida y recuperación de audiencia, velocidad de captura y crecimiento del combo. El combo tiene un máximo de **×4**.

| Dificultad | Uso principal | Audiencia inicial | Pérdida sin señal | Protección |
| --- | --- | ---: | ---: | --- |
| Iniciación | Carrera 1 | 85% | ×0,52 | Una segunda oportunidad |
| Fácil | Carrera 2, Copa 1, Arcade 1 | 82% | ×0,68 | — |
| Normal | Carrera 3, Copa 2 | 78% | ×0,84 | — |
| Difícil | Carrera 4, Copa 3, Arcade 2 | 74% | ×1,00 | — |
| Leyenda | Carrera 5, Arcade 3 | 70% | ×1,12 | — |

- La segunda oportunidad de Iniciación restaura 45% de audiencia, reinicia el combo y descuenta como máximo 100 puntos. Sólo puede ocurrir una vez por partida.
- La Copa recorre los estadios 2, 3 y 4 de Carrera. Sus rondas multiplican la puntuación por ×1, ×1,05 y ×1,10, aumentan gradualmente los incidentes y comienzan con 3 cargas de repetición. Las medallas de Copa se guardan aparte de las de Carrera y el récord de campeón usa el total del torneo.
- Arcade no termina antes de tiempo al perder toda la audiencia: recupera 30%, reinicia el combo y resta hasta 250 puntos. Su multiplicador de puntuación no vuelve a aplicarse a las recompensas.
- Las mejoras no son necesarias para obtener bronce. Estabilizador añade **+0,025** de calidad por nivel (máximo +0,075), Autoenfoque acelera la captura **12% por nivel** (máximo +36%) y Repeticiones añade **+1 de capacidad** por nivel, sin regalar cargas iniciales. La capacidad base es 3; Carrera y Arcade comienzan con 2 cargas.

`src/utils/balance.ts` contiene las fórmulas compartidas de puntuación, audiencia, combo y recuperación. Sus pruebas simulan partidas sin mejoras para comprobar que los objetivos de bronce sigan siendo alcanzables y que la final exija más precisión que el primer estadio.

## Desarrollo web

Requisitos: **Node.js 22 o superior**.

```bash
npm ci
npm run dev
```

La vista previa de producción se genera y se sirve con:

```bash
npm run build
npm run preview
```

Comprobaciones disponibles:

```bash
npm run typecheck   # TypeScript estricto
npm test            # Motor, equilibrio, invariantes y progresión
npm run build       # Bundle de producción autocontenido
```

### PWA y funcionamiento offline

`public/manifest.webmanifest` y `public/sw.js` permiten instalar la versión web y abrirla sin conexión después de la primera carga. Las fuentes, iconos y el código se sirven localmente; no se depende de Google Fonts, CDNs, cuentas ni backends. El service worker solo se registra en producción y fuera del paquete nativo.

## Android

El proyecto nativo se encuentra en `android/` y usa **Capacitor 8**.

- ID de aplicación: `com.camsoccer.broadcast`
- Android mínimo: **7.0 / API 24**
- Target y compile SDK: **36**
- Version inicial: `1.0.0` (`versionCode 1`)
- Plugins: botón Atrás, vibración y barra de estado.
- Recursos web copiados dentro del paquete: el juego funciona offline.

Para sincronizar después de modificar la web:

```bash
npm run android:sync
```

Para abrir el proyecto nativo (en un equipo con Android Studio):

```bash
npm run android:open
```

Para generar un paquete de publicación se necesita un JDK compatible, Android SDK 36 y un keystore propio. **El repositorio no contiene claves de firma ni un AAB firmado.** Consulta [`PLAY_STORE.md`](./PLAY_STORE.md) para la checklist completa.

## Controles

| Acción | Táctil | Teclado |
| --- | --- | --- |
| Mover cámara | Toca/arrastra el mapa o usa el joystick | WASD / Flechas |
| Zoom | Botones − y + | Q / E |
| Repetición | Botón ¡TOMA! | Espacio |
| Pausa | Botón de pausa | Esc |

El monitor superior es la señal que recibe la audiencia. El mapa central controla el encuadre y la consola inferior ofrece precisión. Mantener un evento centrado completa su captura; activar ¡TOMA! antes de que esté listo consume una carga y rompe el combo.

En la **práctica de la portada**, arrastra el monitor o el mapa táctico, usa los botones −/+ y centra cada sujeto con sus accesos. Pulsa **Porteros** de nuevo para alternar entre el local y el visitante. El sujeto elegido se sigue automáticamente hasta que muevas la cámara manualmente. Con el canvas enfocado también funcionan WASD/flechas y Q/E. No hay recompensas, cargas, tiempo límite ni condiciones de derrota.

`src/utils/camera.ts` comparte la proyección, los límites y el encuadre entre la partida y la práctica. `src/utils/broadcastRenderer.ts` contiene los mismos modelos articulados de jugadores, balón e incidentes en ambas vistas. `src/utils/stadiumRenderer.ts` dibuja las gradas y `src/utils/crowd.ts` garantiza asientos persistentes y regula los abucheos; sus pruebas cubren vaciado, recuperación, pausas entre oleadas y audiencia crítica.

## Persistencia y privacidad

Récords, desbloqueos, medallas, monedas, mejoras y ajustes se guardan únicamente en `localStorage` del dispositivo. No hay analítica, publicidad, rastreadores ni transmisión de datos a un servidor. Más detalles en [`PRIVACY.md`](./PRIVACY.md).

## Recursos de marca

- `public/`: iconos PWA, manifest y service worker.
- `store-assets/`: icono, feature graphic y capturas para la ficha.
- `scripts/generate_icons.py`: regenera los iconos web.
- `scripts/prepare_android_assets.py`: aplica la marca a launcher y splash de Android.
- `scripts/generate_store_assets.py`: genera el icono y el feature graphic de la ficha.

Los scripts de imágenes son herramientas opcionales de desarrollo y requieren Pillow; no son necesarios para compilar o jugar.
