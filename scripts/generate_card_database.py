#!/usr/bin/env python3
"""Generate the compressed offline card catalog from Scryfall all_cards data."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import sqlite3
import sys
import tempfile
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

USER_AGENT = "magic_catalog/1.0 (card database generator)"
BULK_DATA_URL = "https://api.scryfall.com/bulk-data"
SCHEMA_VERSION = 7
ARTIFACT_VERSION = "1"
VALID_RARITIES = {"common", "uncommon", "rare", "mythic"}
VALID_COLORS = {"W", "U", "B", "R", "G"}
EXCLUDED_LAYOUTS = {"token", "double_faced_token", "art_series"}
# Formats tracked for inclusion and per-card legality. A card is kept if it is
# legal, restricted, or banned (i.e. tournament-relevant) in at least one of
# these formats; cards that are not_legal everywhere are excluded.
TRACKED_FORMATS = (
    "standard",
    "pioneer",
    "modern",
    "pauper",
    "legacy",
    "vintage",
    "commander",
)
INCLUDED_LEGALITY_STATUSES = {"legal", "restricted", "banned"}


def fetch_json(url: str) -> dict[str, Any]:
    for attempt in range(3):
        request = urllib.request.Request(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except (OSError, json.JSONDecodeError):
            if attempt == 2:
                raise
            time.sleep(1.5)

    raise RuntimeError("Unable to fetch Scryfall data.")


def get_image_url(data: dict[str, Any], key: str) -> str:
    image_uris = data.get("image_uris")
    if not isinstance(image_uris, dict):
        return ""
    value = image_uris.get(key)
    return value if isinstance(value, str) else ""


def safe_colors(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [color for color in value if isinstance(color, str) and color in VALID_COLORS]


def build_face(data: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    image_url = get_image_url(data, "normal") or get_image_url(fallback, "normal")
    art_crop_url = (
        get_image_url(data, "art_crop")
        or get_image_url(fallback, "art_crop")
        or image_url
    )
    # Flip-layout faces (e.g. Kamigawa flip cards) omit "colors" entirely since
    # the whole card shares one mana cost; fall back to the card-level colors.
    colors = data["colors"] if "colors" in data else fallback.get("colors")
    face: dict[str, Any] = {
        "name": data.get("name", ""),
        "manaCost": data.get("mana_cost", ""),
        "typeLine": data.get("type_line", ""),
        "oracleText": data.get("oracle_text", ""),
        "colors": safe_colors(colors),
        "imageUrl": image_url,
        "artCropUrl": art_crop_url,
    }

    for source, target in (("power", "power"), ("toughness", "toughness"), ("loyalty", "loyalty")):
        value = data.get(source)
        if isinstance(value, str) and value:
            face[target] = value

    return face


def extract_legalities(data: dict[str, Any]) -> dict[str, str]:
    raw_legalities = data.get("legalities")
    legalities = raw_legalities if isinstance(raw_legalities, dict) else {}
    return {
        format_name: legalities.get(format_name, "not_legal")
        for format_name in TRACKED_FORMATS
    }


def is_tournament_legal(legalities: dict[str, str]) -> bool:
    return any(status in INCLUDED_LEGALITY_STATUSES for status in legalities.values())


def is_unreleased(data: dict[str, Any], reference_date: str) -> bool:
    # Preview/spoiled cards report "not_legal" everywhere until their set
    # actually releases, so a future released_at is the only signal that
    # they'll eventually be tournament-legal.
    released_at = data.get("released_at")
    return isinstance(released_at, str) and released_at > reference_date


def normalize_card(
    data: dict[str, Any],
    reference_date: str,
    allowed_sets: set[str] | None = None,
) -> dict[str, Any] | None:
    if data.get("lang") != "en":
        return None

    if data.get("layout") in EXCLUDED_LAYOUTS:
        return None

    legalities = extract_legalities(data)
    if not is_tournament_legal(legalities) and not is_unreleased(data, reference_date):
        return None

    set_type = data.get("set_type")

    set_code = data.get("set")
    if allowed_sets is not None and (
        not isinstance(set_code, str) or set_code not in allowed_sets
    ):
        return None

    collector_number = data.get("collector_number")
    card_id = data.get("id")
    if not all(isinstance(value, str) and value for value in (set_code, collector_number, card_id)):
        return None

    raw_faces = data.get("card_faces")
    if isinstance(raw_faces, list) and raw_faces:
        faces = [
            build_face(face, data)
            for face in raw_faces
            if isinstance(face, dict)
        ]
    else:
        faces = [build_face(data, data)]

    if not faces:
        return None

    rarity = data.get("rarity")
    if rarity not in VALID_RARITIES:
        rarity = "common"

    return {
        "id": card_id,
        "set": set_code,
        "setType": set_type,
        "setName": data.get("set_name", ""),
        "releasedAt": data.get("released_at", ""),
        "collectorNumber": collector_number,
        "oracleId": data.get("oracle_id", ""),
        "rarity": rarity,
        "faces": faces,
        "legalities": legalities,
    }


def default_previous_database_url() -> str | None:
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        return None
    return f"https://github.com/{repo}/releases/download/card-database-latest/catalog.sqlite.gz"


def fetch_previous_added_dates(url: str) -> dict[str, str]:
    """Read each card's 'added_at' from a previously published database, so
    repeat runs can carry forward the date a card was first seen instead of
    resetting it to today (Scryfall exposes no spoiler/preview date)."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        compressed = response.read()

    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as handle:
        handle.write(gzip.decompress(compressed))
        temp_path = Path(handle.name)

    try:
        database = sqlite3.connect(temp_path)
        try:
            columns = database.execute("PRAGMA table_info(cards)").fetchall()
            if not any(column[1] == "added_at" for column in columns):
                return {}
            rows = database.execute(
                "SELECT id, added_at FROM cards WHERE added_at != ''"
            ).fetchall()
            return {row[0]: row[1] for row in rows}
        finally:
            database.close()
    finally:
        temp_path.unlink(missing_ok=True)


def find_bulk_download_url(data_type: str) -> tuple[str, str]:
    payload = fetch_json(BULK_DATA_URL)
    for item in payload.get("data", []):
        if isinstance(item, dict) and item.get("type") == data_type:
            download_url = item.get("jsonl_download_uri")
            if isinstance(download_url, str) and download_url:
                return download_url, item.get("updated_at", "")

            raise RuntimeError(
                f"Scryfall's {data_type} bulk-data entry has no "
                "jsonl_download_uri."
            )

    raise RuntimeError(f"Scryfall did not provide a {data_type} bulk-data entry.")


def load_previous_metadata(path: Path) -> dict | None:
    """Load metadata from a previous run to check if Scryfall data has changed."""
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None


def compress_and_checksum_database(
    temp_sqlite_path: Path, temporary_database_path: Path
) -> tuple[str, int, int]:
    """Compress SQLite database and calculate checksum.
    
    Returns:
        Tuple of (checksum_hex, compressed_bytes, uncompressed_bytes)
    """
    database_checksum = hashlib.sha256()
    uncompressed_bytes = temp_sqlite_path.stat().st_size
    
    with open(temp_sqlite_path, 'rb') as sqlite_file:
        with gzip.open(temporary_database_path, 'wb', compresslevel=9) as database_output:
            while chunk := sqlite_file.read(1024 * 1024):
                database_checksum.update(chunk)
                database_output.write(chunk)
    
    compressed_bytes = temporary_database_path.stat().st_size
    return database_checksum.hexdigest(), compressed_bytes, uncompressed_bytes


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", default="artifacts/card-database")
    parser.add_argument("--download-url", help="Use a local/test bulk-data URL instead of Scryfall metadata.")
    parser.add_argument(
        "--sets",
        help="Comma-separated set codes to include; omit to include all sets.",
    )
    parser.add_argument(
        "--previous-database-url",
        help=(
            "URL of a previously published catalog.sqlite.gz used to carry "
            "forward each card's first-seen ('added') date; defaults to the "
            "current GitHub release when GITHUB_REPOSITORY is set."
        ),
    )
    parser.add_argument(
        "--skip-previous-lookup",
        action="store_true",
        help="Skip fetching the previous release database; every card is stamped with today's date as its 'added' date.",
    )
    return parser.parse_args()


def default_added_at(card: dict[str, Any], generation_date: str) -> str:
    """Approximate 'added' date for a card with no prior recorded value: its
    set's release date if already released (so backfilled/unknown history
    doesn't look newer than it is), otherwise today (a future release date
    means the card was spoiled ahead of release)."""
    released_at = card.get("releasedAt") or ""
    if released_at and released_at <= generation_date:
        return released_at
    return generation_date


def build_sqlite_database(
    cards_path: Path,
    rulings_path: Path,
    database_path: Path,
    previous_added_dates: dict[str, str],
    generation_date: str,
    recent_only: bool = False,
    cutoff_date: str = "",
) -> tuple[int, int, int]:
    """Build SQLite database from card and ruling data.
    
    Args:
        cards_path: Path to compressed JSONL cards file
        rulings_path: Path to compressed JSONL rulings file
        database_path: Output path for SQLite database
        previous_added_dates: Map of card IDs to their added_at dates
        generation_date: Current generation date (YYYY-MM-DD)
        recent_only: If True, only include cards with added_at >= cutoff_date
        cutoff_date: Filter cards added after this date (YYYY-MM-DD format)
        
    Returns:
        Tuple of (card_count, rulings_count, uncompressed_bytes)
    """
    database = sqlite3.connect(database_path)
    database.executescript('''
        CREATE TABLE cards (
            id TEXT PRIMARY KEY,
            set_code TEXT NOT NULL,
            set_type TEXT NOT NULL DEFAULT '',
            released_at TEXT NOT NULL DEFAULT '',
            collector_number TEXT NOT NULL,
            oracle_id TEXT,
            rarity TEXT NOT NULL,
            faces_json TEXT NOT NULL,
            added_at TEXT NOT NULL DEFAULT '',
            legalities_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE TABLE face_types (
            card_id TEXT NOT NULL,
            face_index INTEGER NOT NULL,
            type_name TEXT NOT NULL,
            PRIMARY KEY (card_id, face_index, type_name)
        );
        CREATE TABLE face_subtypes (
            card_id TEXT NOT NULL,
            face_index INTEGER NOT NULL,
            subtype_name TEXT NOT NULL,
            PRIMARY KEY (card_id, face_index, subtype_name)
        );
        CREATE TABLE face_colors (
            card_id TEXT NOT NULL,
            face_index INTEGER NOT NULL,
            color TEXT NOT NULL,
            PRIMARY KEY (card_id, face_index, color)
        );
        CREATE TABLE rulings (
            oracle_id TEXT NOT NULL,
            object TEXT NOT NULL,
            source TEXT NOT NULL,
            published_at TEXT NOT NULL,
            comment TEXT NOT NULL
        );
        CREATE TABLE sets (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            set_type TEXT NOT NULL DEFAULT '',
            released_at TEXT NOT NULL DEFAULT ''
        );
    ''')

    sets_seen: dict[str, tuple[str, str, str]] = {}
    card_count = 0
    uncompressed_bytes = 0
    oracle_ids: set[str] = set()

    with gzip.open(cards_path, 'rt', encoding='utf-8') as cards_file:
        for line in cards_file:
            card = json.loads(line)
            card_added_at = previous_added_dates.get(card['id']) or default_added_at(card, generation_date)
            
            # Filter by date if recent_only is True
            if recent_only and card_added_at < cutoff_date:
                continue
            
            database.execute(
                'INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (
                    card['id'], card['set'], card.get('setType', ''),
                    card.get('releasedAt', ''),
                    card['collectorNumber'],
                    card.get('oracleId'), card['rarity'],
                    json.dumps(card['faces'], ensure_ascii=True, separators=(',', ':')),
                    card_added_at,
                    json.dumps(card.get('legalities', {}), ensure_ascii=True, separators=(',', ':')),
                ),
            )
            card_count += 1
            
            # Track oracle IDs for rulings
            oracle_id = card.get('oracleId')
            if isinstance(oracle_id, str) and oracle_id:
                oracle_ids.add(oracle_id)
            
            # Track set info
            sets_seen.setdefault(
                card['set'],
                (card.get('setName', ''), card.get('setType', ''), card.get('releasedAt', '')),
            )
            
            # Build face indices
            for face_index, face in enumerate(card['faces']):
                type_line = face.get('typeLine', '')
                main_part, _, subtype_part = type_line.partition('\u2014')
                main_types = main_part.strip().lower().split()
                for type_name in main_types:
                    if type_name not in {'legendary', 'basic', 'snow', 'world', 'ongoing'}:
                        database.execute(
                            'INSERT OR IGNORE INTO face_types VALUES (?, ?, ?)',
                            (card['id'], face_index, type_name),
                        )
                for subtype_name in subtype_part.strip().lower().split():
                    database.execute(
                        'INSERT OR IGNORE INTO face_subtypes VALUES (?, ?, ?)',
                        (card['id'], face_index, subtype_name),
                    )
                for color in face.get('colors', []):
                    database.execute(
                        'INSERT OR IGNORE INTO face_colors VALUES (?, ?, ?)',
                        (card['id'], face_index, color),
                    )

    for set_code, (set_name, set_type, released_at) in sets_seen.items():
        database.execute(
            'INSERT OR IGNORE INTO sets VALUES (?, ?, ?, ?)',
            (set_code, set_name, set_type, released_at),
        )

    rulings_count = 0
    with gzip.open(rulings_path, 'rt', encoding='utf-8') as rulings_file:
        for line in rulings_file:
            ruling = json.loads(line)
            oracle_id = ruling.get("oracle_id")
            if oracle_id not in oracle_ids:
                continue

            database.execute(
                'INSERT INTO rulings VALUES (?, ?, ?, ?, ?)',
                (
                    oracle_id, ruling.get("object", "ruling"),
                    ruling.get("source", ""), ruling.get("published_at", ""),
                    ruling.get("comment", ""),
                ),
            )
            rulings_count += 1

    database.executescript('''
        CREATE INDEX cards_set_idx ON cards(set_code);
        CREATE INDEX cards_rarity_idx ON cards(rarity);
        CREATE INDEX cards_added_at_idx ON cards(added_at);
        CREATE INDEX face_types_name_idx ON face_types(type_name);
        CREATE INDEX face_types_card_idx ON face_types(card_id);
        CREATE INDEX face_subtypes_name_idx ON face_subtypes(subtype_name);
        CREATE INDEX face_subtypes_card_idx ON face_subtypes(card_id);
        CREATE INDEX face_colors_color_idx ON face_colors(color);
        CREATE INDEX face_colors_card_idx ON face_colors(card_id);
        CREATE INDEX rulings_oracle_idx ON rulings(oracle_id, published_at);
        CREATE INDEX sets_released_at_idx ON sets(released_at);
    ''')
    database.commit()
    database.close()
    
    return card_count, rulings_count, 0  # uncompressed_bytes will be set by caller


def main() -> int:
    generation_started_at = time.perf_counter()
    run_timestamp = datetime.now(timezone.utc)
    generated_at = run_timestamp.isoformat()
    generation_date = run_timestamp.date().isoformat()
    args = parse_args()
    allowed_sets = (
        {set_code.strip().lower() for set_code in args.sets.split(",") if set_code.strip()}
        if args.sets
        else None
    )
    root_dir = Path(__file__).resolve().parent.parent
    output_dir = (root_dir / args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = output_dir / "metadata.json"
    database_path = output_dir / "catalog.sqlite.gz"

    # If no custom options are set and we have a previous database, check if Scryfall data has changed
    if not args.download_url and not args.sets:
        previous_metadata = load_previous_metadata(metadata_path)
        if previous_metadata and database_path.exists():
            print("Checking if Scryfall data has been updated...", file=sys.stderr)
            try:
                _, source_updated_at = find_bulk_download_url("all_cards")
                _, rulings_updated_at = find_bulk_download_url("rulings")
                
                if (
                    previous_metadata.get("sourceUpdatedAt") == source_updated_at
                    and previous_metadata.get("rulingsSourceUpdatedAt") == rulings_updated_at
                ):
                    print(
                        f"[generate-card-database] Scryfall data unchanged; skipping download",
                        file=sys.stderr,
                    )
                    return 0
                else:
                    print("[generate-card-database] Scryfall data has been updated; regenerating...", file=sys.stderr)
            except Exception as error:
                print(
                    f"Warning: could not check for updates ({error}); proceeding with regeneration.",
                    file=sys.stderr,
                )

    previous_added_dates: dict[str, str] = {}
    if not args.skip_previous_lookup:
        previous_database_url = args.previous_database_url or default_previous_database_url()
        if previous_database_url:
            print(f"Fetching previous card database from {previous_database_url}...", file=sys.stderr)
            try:
                previous_added_dates = fetch_previous_added_dates(previous_database_url)
                print(
                    f"Loaded {len(previous_added_dates)} known 'added' dates from the previous release.",
                    file=sys.stderr,
                )
            except Exception as error:
                print(
                    f"Warning: could not load previous card database ({error}); "
                    "treating all cards as newly added today.",
                    file=sys.stderr,
                )

    if args.download_url:
        download_url = args.download_url
        source_updated_at = ""
    else:
        print("Fetching Scryfall bulk-data metadata...", file=sys.stderr)
        download_url, source_updated_at = find_bulk_download_url("all_cards")

    if args.download_url:
        rulings_download_url = args.download_url
        rulings_updated_at = ""
    else:
        print("Fetching Scryfall rulings bulk-data metadata...", file=sys.stderr)
        rulings_download_url, rulings_updated_at = find_bulk_download_url("rulings")

    artifact_path = output_dir / "cards.jsonl.gz"
    run_id = f"{os.getpid()}-{time.time_ns()}"
    temporary_artifact_path = output_dir / f"cards.jsonl.gz.{run_id}.tmp"
    checksum = hashlib.sha256()
    rulings_checksum = hashlib.sha256()
    card_count = 0
    rulings_count = 0
    uncompressed_bytes = 0
    rulings_uncompressed_bytes = 0
    oracle_ids: set[str] = set()
    rulings_path = output_dir / "rulings.jsonl.gz"
    temporary_rulings_path = output_dir / f"rulings.jsonl.gz.{run_id}.tmp"
    database_path = output_dir / "catalog.sqlite.gz"
    temporary_database_path = output_dir / f"catalog.sqlite.gz.{run_id}.tmp"
    temporary_sqlite_path = output_dir / f"catalog.sqlite.{run_id}.tmp"

    request = urllib.request.Request(download_url, headers={"User-Agent": USER_AGENT})
    print(f"Downloading card data from {download_url}...", file=sys.stderr)
    cards_started_at = time.perf_counter()

    with urllib.request.urlopen(request, timeout=600) as response:
        raw_stream = gzip.GzipFile(fileobj=response) if download_url.endswith(".gz") else response
        with gzip.open(temporary_artifact_path, "wb", compresslevel=9) as output:
            for raw_line in raw_stream:
                if isinstance(raw_line, bytes):
                    line = raw_line
                else:
                    line = raw_line.encode("utf-8")

                if not line.strip():
                    continue

                normalized = normalize_card(json.loads(line), generation_date, allowed_sets)
                if normalized is None:
                    continue

                oracle_id = normalized.get("oracleId")
                if isinstance(oracle_id, str) and oracle_id:
                    oracle_ids.add(oracle_id)

                encoded = (json.dumps(normalized, ensure_ascii=True, separators=(",", ":")) + "\n").encode("utf-8")
                output.write(encoded)
                checksum.update(encoded)
                uncompressed_bytes += len(encoded)
                card_count += 1

    print(
        f"Finished cards: {card_count} records in "
        f"{time.perf_counter() - cards_started_at:.2f}s",
        file=sys.stderr,
    )

    print(f"Downloading rulings bulk data for {len(oracle_ids)} Oracle cards...", file=sys.stderr)
    rulings_started_at = time.perf_counter()
    rulings_request = urllib.request.Request(
        rulings_download_url,
        headers={"User-Agent": USER_AGENT},
    )
    with gzip.open(temporary_rulings_path, "wb", compresslevel=9) as rulings_output:
        with urllib.request.urlopen(rulings_request, timeout=600) as response:
            rulings_stream = gzip.GzipFile(fileobj=response)
            for raw_line in rulings_stream:
                ruling = json.loads(raw_line)
                oracle_id = ruling.get("oracle_id")
                if oracle_id not in oracle_ids:
                    continue

                normalized_ruling = {
                    "oracleId": oracle_id,
                    "object": ruling.get("object", "ruling"),
                    "oracle_id": oracle_id,
                    "source": ruling.get("source", ""),
                    "published_at": ruling.get("published_at", ""),
                    "comment": ruling.get("comment", ""),
                }
                encoded = (json.dumps(normalized_ruling, ensure_ascii=True, separators=(",", ":")) + "\n").encode("utf-8")
                rulings_output.write(encoded)
                rulings_checksum.update(encoded)
                rulings_uncompressed_bytes += len(encoded)
                rulings_count += 1

    print(
        f"Finished rulings: {rulings_count} records in "
        f"{time.perf_counter() - rulings_started_at:.2f}s",
        file=sys.stderr,
    )

    temporary_artifact_path.replace(artifact_path)
    temporary_rulings_path.replace(rulings_path)

    # Calculate 3-month cutoff date for recent database
    run_datetime = datetime.fromisoformat(generated_at)
    three_months_ago = (run_datetime - timedelta(days=90)).date().isoformat()

    sqlite_started_at = time.perf_counter()
    
    # Build full database
    print("[generate-card-database] Building full database...", file=sys.stderr)
    temporary_sqlite_path = output_dir / f"catalog.sqlite.{run_id}.tmp"
    card_count_full, rulings_count_full, _ = build_sqlite_database(
        artifact_path,
        rulings_path,
        temporary_sqlite_path,
        previous_added_dates,
        generation_date,
        recent_only=False,
        cutoff_date="",
    )
    
    database_path = output_dir / "catalog.sqlite.gz"
    temporary_database_path = output_dir / f"catalog.sqlite.gz.{run_id}.tmp"
    checksum_full, compressed_bytes_full, uncompressed_bytes_full = compress_and_checksum_database(
        temporary_sqlite_path, temporary_database_path
    )
    temporary_sqlite_path.unlink()
    temporary_database_path.replace(database_path)
    
    # Build recent database (last 3 months)
    print("[generate-card-database] Building recent database (last 3 months)...", file=sys.stderr)
    temporary_sqlite_recent_path = output_dir / f"catalog-recent.sqlite.{run_id}.tmp"
    card_count_recent, rulings_count_recent, _ = build_sqlite_database(
        artifact_path,
        rulings_path,
        temporary_sqlite_recent_path,
        previous_added_dates,
        generation_date,
        recent_only=True,
        cutoff_date=three_months_ago,
    )
    
    database_recent_path = output_dir / "catalog-recent.sqlite.gz"
    temporary_database_recent_path = output_dir / f"catalog-recent.sqlite.gz.{run_id}.tmp"
    checksum_recent, compressed_bytes_recent, uncompressed_bytes_recent = compress_and_checksum_database(
        temporary_sqlite_recent_path, temporary_database_recent_path
    )
    temporary_sqlite_recent_path.unlink()
    temporary_database_recent_path.replace(database_recent_path)
    
    # Cleanup intermediate files
    artifact_path.unlink()
    rulings_path.unlink()
    
    print(
        f"Finished SQLite databases in {time.perf_counter() - sqlite_started_at:.2f}s",
        file=sys.stderr,
    )

    # Update metadata with both databases
    metadata = {
        "artifactVersion": ARTIFACT_VERSION,
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": generated_at,
        "sourceUpdatedAt": source_updated_at,
        "rulingsSourceUpdatedAt": rulings_updated_at,
        "cardCount": card_count_full,
        "rulingsCount": rulings_count_full,
        "sets": sorted(allowed_sets) if allowed_sets is not None else None,
        "dbFormat": "sqlite",
        "databases": {
            "full": {
                "assetName": "catalog.sqlite.gz",
                "cardCount": card_count_full,
                "rulingsCount": rulings_count_full,
                "checksum": checksum_full,
                "compressedBytes": compressed_bytes_full,
                "uncompressedBytes": uncompressed_bytes_full,
            },
            "recent": {
                "assetName": "catalog-recent.sqlite.gz",
                "cardCount": card_count_recent,
                "rulingsCount": rulings_count_recent,
                "checksum": checksum_recent,
                "compressedBytes": compressed_bytes_recent,
                "uncompressedBytes": uncompressed_bytes_recent,
                "description": "Cards added in the last 3 months",
                "cutoffDate": three_months_ago,
            },
        },
        # Legacy fields for backward compatibility
        "databaseAssetName": "catalog.sqlite.gz",
        "databaseChecksum": checksum_full,
        "databaseCompressedBytes": compressed_bytes_full,
        "databaseUncompressedBytes": uncompressed_bytes_full,
    }
    temporary_metadata_path = output_dir / f"metadata.json.{run_id}.tmp"
    temporary_metadata_path.write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_metadata_path.replace(output_dir / "metadata.json")
    print(
        f"Generated SQLite databases: full ({card_count_full} cards) and "
        f"recent ({card_count_recent} cards, last 3 months) in "
        f"{time.perf_counter() - generation_started_at:.2f}s"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
