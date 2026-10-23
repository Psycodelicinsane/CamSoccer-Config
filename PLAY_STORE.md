# Checklist de publicación en Google Play

La aplicación incluye el proyecto Android y los recursos de ficha, pero **la subida siempre debe hacerla el titular desde su propia cuenta de Google Play Console**. No compartas el keystore ni sus contraseñas en el repositorio o en el chat.

## 1. Compilar y verificar

1. Instala Node.js 22+, un JDK compatible con el Android Gradle Plugin incluido y Android Studio con SDK 36.
2. Ejecuta:
   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run android:sync
   npm run android:open
   ```
3. Prueba el paquete en al menos un teléfono físico pequeño, uno moderno y una tablet. Verifica retrato, paisaje, botón Atrás, interrupciones, audio, vibración y funcionamiento en modo avión.
4. En Android Studio usa **Build → Generate Signed App Bundle / APK → Android App Bundle → release**.
5. Crea y guarda un keystore privado. Configura Play App Signing en Play Console y conserva también la clave de subida en un gestor seguro.
6. Instala el AAB mediante una pista de prueba interna antes de promoverlo a producción.

> El AAB de release y el keystore están excluidos de Git. Incrementa `versionCode` en cada subida y actualiza `versionName` en `android/app/build.gradle`.

## 2. Ficha de Play Store

**Nombre**

CamSoccer · Broadcast Club

**Descripción corta**

Dirige la cámara, captura la jugada y conquista la Copa Broadcast.

**Descripción larga propuesta**

El fútbol también se gana detrás de la cámara. En CamSoccer no controlas a los futbolistas: diriges la retransmisión y decides qué ve la audiencia.

Sigue el balón, encuadra disparos y goles, reacciona a los incidentes más inesperados y corta a repetición justo cuando el estadio contiene la respiración. Cada plano suma puntos; cada decisión puede salvar tu señal.

• Carrera con 5 estadios y dificultad progresiva.
• Copa Broadcast con 3 eliminatorias.
• 3 niveles arcade de partidas rápidas y puntuación aumentada.
• Medallas, récords, experiencia y mejoras permanentes de cámara.
• Partido simulado con pases, regates, robos, paradas y goles.
• Controles táctiles, zoom, joystick y vibración opcional.
• Diseño para teléfonos y tablets, en retrato o paisaje.
• Juego offline, sin anuncios y sin compras dentro de la aplicación.

Mantén la audiencia. Captura la historia. Sal al aire.

**Categoría sugerida:** Juegos / Deportes o Casual.

**Recursos incluidos en `store-assets/`:**

- Icono de 512 × 512 PNG.
- Feature graphic de 1024 × 500 PNG.
- Capturas de teléfono de 1080 × 1920 PNG.

Añade capturas de tablet si marcas esa familia de dispositivos en el catálogo. Las imágenes no contienen afirmaciones engañosas ni marcas de terceros.

## 3. Formularios obligatorios

- **Privacidad:** publica el contenido de `PRIVACY.md` en una URL accesible y añade esa URL a la ficha. El repositorio puede servir como punto de contacto: https://github.com/Psycodelicinsane/CamSoccer-Config/issues
- **Seguridad de datos:** indicar que no se recopilan ni comparten datos personales. El progreso se guarda localmente. Revisa el formulario si añades analítica, anuncios, cuentas o servicios en el futuro.
- **Anuncios:** declarar que la aplicación no contiene anuncios.
- **Compras:** no hay compras; las monedas solo se obtienen jugando y no se venden.
- **Clasificación de contenido:** responder según el cuestionario vigente. Hay disputas cómicas pixeladas y un intruso censurado, sin sangre, apuestas ni contenido sexual explícito.
- **Público objetivo:** no marcar como dirigido específicamente a menores sin revisar los requisitos de familias.
- **Accesibilidad y noticias:** completa las declaraciones actuales de Play Console.
- **Derechos:** el código, la interfaz, los sonidos sintetizados y los recursos son locales al proyecto; no utiliza escudos, ligas, futbolistas ni retransmisiones reales.

## 4. Antes de producción

- Sustituye cualquier texto de contacto que el titular quiera personalizar y confirma que el enlace de privacidad responde sin iniciar sesión.
- Revisa el nombre definitivo del paquete; no se puede cambiar después de publicar.
- Verifica que la versión sincronizada en `android/app/src/main/assets/public` coincide con la build probada.
- Completa prueba cerrada, informe de pre-lanzamiento y correcciones de políticas.
- Promueve la misma versión probada a producción y conserva notas de la versión en español.
