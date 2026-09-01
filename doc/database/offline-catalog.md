# Offline Card Catalog

The application stores normalized Scryfall card data in a prebuilt SQLite database loaded by SQLite WASM. The SQLite bytes are persisted in browser IndexedDB under `magic-catalog-sqlite`; card images remain remote Scryfall URLs.

## Generate the artifact

Generate the English-only full-print catalog from Scryfall's `all_cards` bulk data:

```sh
npm run data:database
```

The command writes these files to `artifacts/card-database/`:

- `catalog.sqlite.gz`: prebuilt SQLite database with card, face, type, color, and ruling indexes
- `metadata.json`: artifact version, schema version, timestamps, card count, sizes, and SHA-256 checksum

Only records whose Scryfall `lang` field is `en` are included. A card is included only if it is `legal`, `restricted`, or `banned` (i.e. tournament-relevant) in at least one of these formats: `standard`, `pioneer`, `modern`, `pauper`, `legacy`, `vintage`, `commander`. Cards that are `not_legal` in all of them are excluded, regardless of set type. Unreleased/preview cards (`released_at` in the future) report `not_legal` everywhere on Scryfall until their set actually releases, so they're included anyway based on that future release date. Each card row also stores its legality status (`legal`, `not_legal`, `restricted`, or `banned`) for every tracked format. Token cards (`token` and `double_faced_token` layouts) and art-series cards (`art_series` layout) are also skipped before the artifact is written. Rulings are loaded from Scryfall's bulk rulings file and filtered by the selected cards' `oracle_id` values; no per-card rulings requests are made.

Scryfall does not expose a card's spoiler/preview date, so each card row also carries an `added_at` date approximating one: the date it was first seen in a generated database. On each run, the generator downloads the previously published `catalog.sqlite.gz` (from `--previous-database-url`, or the current GitHub release when `GITHUB_REPOSITORY` is set) to carry forward known `added_at` values. A card with no prior recorded value falls back to its set's `released_at` date if that date has already passed (so backfilled or historical cards aren't misreported as newly added), or to today's date if the release date is still in the future (a spoiled-but-unreleased card). Pass `--skip-previous-lookup` to stamp every card with its fallback date instead of checking history (e.g. for one-off local runs). Because this value only reflects when *this generator* first recorded a card, its accuracy depends on how often the artifact is regenerated.

To generate only the requested sets, pass their Scryfall set codes:

```sh
python3 scripts/generate_card_database.py \
	--sets hob,sos,tla,mh1,mh2,mh3 \
	--output-dir artifacts/card-database
```

The selected set codes are also written to `metadata.json`. If `--sets` is omitted, all English sets are included.

The artifact is intentionally not bundled into the Vite application. The browser verifies its checksum, opens it with SQLite WASM, and persists the SQLite bytes only after validation succeeds.

## Publish a release

The workflow in `.github/workflows/card-database.yml` supports both manual dispatch and a scheduled run (every 30 minutes). It publishes both databases and metadata to the `card-database-latest` GitHub Release:

- `catalog.sqlite.gz`: Full database with all cards
- `catalog-recent.sqlite.gz`: Curated database with only cards added in the last 3 months (used for faster bootstrap)
- `metadata.json`: Artifact version, schema version, timestamps, card counts, and checksums for both databases

The browser checks the latest release metadata when online. Queries never require a network connection. After a successful import, the catalog remains available offline.

### Bootstrap Database

On first load, the app downloads and caches `catalog-recent.sqlite.gz` from `public/card-database/bootstrap/` (prebuilt and versioned in git). This recent database is much smaller and loads faster. After the bootstrap completes, the app checks for updates and optionally downloads the full `catalog.sqlite.gz` for comprehensive access to all cards.

## Test locally

After generating the artifact, create `.env.local` in the repository root:

```env
VITE_CATALOG_DATABASE_URL=http://127.0.0.1:8080/catalog.sqlite.gz
VITE_CATALOG_METADATA_URL=http://127.0.0.1:8080/metadata.json
```

Start the artifact server in one terminal:

```sh
npm run data:serve
```

Start Vite in another terminal:

```sh
npm run dev
```

Open `http://localhost:5173/magic_catalog/`. Vite reads `.env.local` when it starts, so restart the dev server after changing these values. Remove `.env.local` or unset both variables to return to the GitHub Release updater.

## Query behavior

Set and rarity queries use SQLite indexes. Face types, colors, and rulings are stored in normalized indexed tables. Fuse.js performs fuzzy matching over the SQL-filtered candidate cards.

Color matching is evaluated per face. If any face matches the requested color, the complete card and all of its faces are returned. WUBRG selections require an exact face color set; `C` matches colorless faces and `M` matches multicolor faces.

When duplicate printings are hidden, the UI selects the newest `core` or `expansion` printing for each card name, then chooses the lowest collector number within that set. The full database still retains all format-legal printings, and “Show all prints” displays them all.
