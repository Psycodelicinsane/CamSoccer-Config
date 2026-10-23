import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.camsoccer.broadcast',
  appName: 'CamSoccer',
  webDir: 'dist',
  backgroundColor: '#080d12',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
