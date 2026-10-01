import { defineConfig } from 'tsup';

// @dialox/shared is a devDependency that ships TypeScript source, so tsup bundles it (and its
// libphonenumber-js) into dist; the production image then needs no workspace links.
export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
});
