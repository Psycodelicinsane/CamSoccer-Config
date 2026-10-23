import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

export function hapticImpact(strong = false) {
  if (!hapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) void Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light });
    else if ('vibrate' in navigator) navigator.vibrate(strong ? 28 : 10);
  } catch { /* Haptics are optional on unsupported devices. */ }
}

export function hapticSuccess() {
  if (!hapticsEnabled) return;
  try {
    if (Capacitor.isNativePlatform()) void Haptics.notification({ type: NotificationType.Success });
    else if ('vibrate' in navigator) navigator.vibrate([18, 35, 18]);
  } catch { /* noop */ }
}

export async function requestFullscreen() {
  if (Capacitor.isNativePlatform()) return;
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch { /* Some mobile browsers only allow fullscreen from their own UI. */ }
}
