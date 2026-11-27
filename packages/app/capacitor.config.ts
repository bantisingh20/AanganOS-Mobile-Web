import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aanganos.resident',
  appName: 'AanganOS',
  webDir: 'dist',
  android: {
    // HTTPS app must never load http:// content (cleartext is also blocked in network_security_config.xml).
    allowMixedContent: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
      backgroundColor: '#00000000',
    },
  },
};

export default config;
