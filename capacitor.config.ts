import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aishhamusik.pemutarmusik',
  appName: 'Pemutar Musik',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  // Pastikan tidak ada block "Permissions" yang aneh di sini
};

export default config;