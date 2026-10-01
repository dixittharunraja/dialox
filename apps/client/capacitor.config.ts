import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.rodix.dialox',
  appName: 'Dialox',
  // Points at the Docker deployment on the LAN instead of bundling static assets: the app talks
  // to a separate API/SMTP backend, so loading it live (like a browser would) avoids having to
  // bake an API base URL into the build. Swap for a public URL once deployed off the LAN.
  webDir: 'dist',
  server: {
    url: 'http://10.11.73.42:8080',
    cleartext: true,
  },
};

export default config;
