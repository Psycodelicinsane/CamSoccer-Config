import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './index.css';
import App from './App';

if (Capacitor.isNativePlatform()) {
  void StatusBar.setStyle({ style: Style.Light });
  void StatusBar.setBackgroundColor({ color: '#080d12' });
  void StatusBar.setOverlaysWebView({ overlay: false });
}

// La versión web instalable guarda una copia offline. El paquete nativo ya
// incluye todos los recursos y no necesita service worker.
if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* Offline support is progressive. */ });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
