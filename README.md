# Github Pages

[https://laisolizq.github.io/magic_catalog/](https://laisolizq.github.io/magic_catalog/)

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Development

### Install dependencies
```
npm install
```

### Start development server
```
npm run dev
```

### Build
To generate the production build:
```
npm run build
```

### Deploy
```
npm run deploy
```

URL: https://laisolizq.github.io/magic_catalog/

Deploy the PWA automatically every time a commit is pushed to main, especially after merging dev → main.

## PWA Support

To make this project installable on mobile/tablet/desktop, we use:

### Vite Plugin PWA
This plugin has been installed:
```
npm install vite-plugin-pwa --save-dev
```
This plugin automatically generates:
  - manifest.json
  - service worker
  - offline caching
  - “Add to Home Screen” installation prompt

## Offline Catalog (SQLite WASM)
Card data is stored in a prebuilt SQLite database and loaded by SQLite WASM. The SQLite bytes are persisted in browser IndexedDB for offline use; card images continue to load from Scryfall.

The artifact generator is:
```
npm run data:database
```

It creates a compressed English-only SQLite database and metadata under `artifacts/card-database/`. Non-English records, token layouts, and art-series layouts are excluded. Rulings come from Scryfall's bulk `rulings` file and are indexed by `oracle_id`. The scheduled/manual workflow publishes `catalog.sqlite.gz` and `metadata.json` to the `card-database-latest` GitHub Release. When online, the app checks the release metadata and replaces the local SQLite database only after checksum validation succeeds.

To generate only `hob`, `sos`, `tla`, `mh1`, `mh2`, and `mh3`:

```sh
python3 scripts/generate_card_database.py --sets hob,sos,tla,mh1,mh2,mh3
```

See [doc/database/offline-catalog.md](doc/database/offline-catalog.md) for the schema, release, and query details.

### Service Workers (Workbox)
Workbox will be used for advanced caching strategies.

Install:
```
npm install workbox-window workbox-build
```

SQLite provides prebuilt indexes for set, rarity, face types, face colors, and rulings. SQLite WASM queries the local database directly, avoiding a large JSONL-to-IndexedDB import on every new release.

Why Workbox?

Workbox simplifies service worker creation and caching strategies:
  - precaching
  - runtime caching
  - offline fallback
  - image caching
  - network-first / cache-first strategies
