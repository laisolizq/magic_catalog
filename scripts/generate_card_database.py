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
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

USER_AGENT = "magic_catalog/1.0 (card database generator)"
BULK_DATA_URL = "https://api.scryfall.com/bulk-data"
SCHEMA_VERSION = 4
ARTIFACT_VERSION = "1"
VALID_RARITIES = {"common", "uncommon", "rare", "mythic"}
VALID_COLORS = {"W", "U", "B", "R", "G"}
EXCLUDED_LAYOUTS = {"token", "double_faced_token", "art_series"}
PLAYABLE_SET_TYPES = {
    "core",
    "expansion",
    "masters",
    "commander",
    "draft_innovation",
    "starter",
}


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


def normalize_card(
    data: dict[str, Any],
    allowed_sets: set[str] | None = None,
) -> dict[str, Any] | None:
    if data.get("lang") != "en":
        return None

    if data.get("layout") in EXCLUDED_LAYOUTS:
        return None

    set_type = data.get("set_type")
    if set_type not in PLAYABLE_SET_TYPES:
        return None

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
        "releasedAt": data.get("released_at", ""),
        "collectorNumber": collector_number,
        "oracleId": data.get("oracle_id", ""),
        "rarity": rarity,
        "faces": faces,
    }


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", default="artifacts/card-database")
    parser.add_argument("--download-url", help="Use a local/test bulk-data URL instead of Scryfall metadata.")
    parser.add_argument(
        "--sets",
        help="Comma-separated set codes to include; omit to include all sets.",
    )
    return parser.parse_args()


def build_sqlite_database(
    cards_path: Path,
    rulings_path: Path,
    database_path: Path,
) -> None:
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
            faces_json TEXT NOT NULL
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
    ''')

    with gzip.open(cards_path, 'rt', encoding='utf-8') as cards_file:
        for line in cards_file:
            card = json.loads(line)
            database.execute(
                'INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                (
                    card['id'], card['set'], card.get('setType', ''),
                    card.get('releasedAt', ''),
                    card['collectorNumber'],
                    card.get('oracleId'), card['rarity'],
                    json.dumps(card['faces'], ensure_ascii=True, separators=(',', ':')),
                ),
            )
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

    with gzip.open(rulings_path, 'rt', encoding='utf-8') as rulings_file:
        for line in rulings_file:
            ruling = json.loads(line)
            database.execute(
                'INSERT INTO rulings VALUES (?, ?, ?, ?, ?)',
                (
                    ruling['oracleId'], ruling.get('object', 'ruling'),
                    ruling.get('source', ''), ruling.get('published_at', ''),
                    ruling.get('comment', ''),
                ),
            )

    database.executescript('''
        CREATE INDEX cards_set_idx ON cards(set_code);
        CREATE INDEX cards_rarity_idx ON cards(rarity);
        CREATE INDEX face_types_name_idx ON face_types(type_name);
        CREATE INDEX face_types_card_idx ON face_types(card_id);
        CREATE INDEX face_subtypes_name_idx ON face_subtypes(subtype_name);
        CREATE INDEX face_subtypes_card_idx ON face_subtypes(card_id);
        CREATE INDEX face_colors_color_idx ON face_colors(color);
        CREATE INDEX face_colors_card_idx ON face_colors(card_id);
        CREATE INDEX rulings_oracle_idx ON rulings(oracle_id, published_at);
    ''')
    database.commit()
    database.close()


def main() -> int:
    generation_started_at = time.perf_counter()
    args = parse_args()
    allowed_sets = (
        {set_code.strip().lower() for set_code in args.sets.split(",") if set_code.strip()}
        if args.sets
        else None
    )
    root_dir = Path(__file__).resolve().parent.parent
    output_dir = (root_dir / args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

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

                normalized = normalize_card(json.loads(line), allowed_sets)
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

    sqlite_started_at = time.perf_counter()
    build_sqlite_database(artifact_path, rulings_path, temporary_sqlite_path)
    database_checksum = hashlib.sha256()
    with open(temporary_sqlite_path, 'rb') as sqlite_file:
        with gzip.open(temporary_database_path, 'wb', compresslevel=9) as database_output:
            while chunk := sqlite_file.read(1024 * 1024):
                database_checksum.update(chunk)
                database_output.write(chunk)
    database_uncompressed_bytes = temporary_sqlite_path.stat().st_size
    temporary_sqlite_path.unlink()
    temporary_database_path.replace(database_path)
    artifact_path.unlink()
    rulings_path.unlink()
    print(
        f"Finished SQLite database in {time.perf_counter() - sqlite_started_at:.2f}s",
        file=sys.stderr,
    )

    generated_at = datetime.now(timezone.utc).isoformat()
    metadata = {
        "artifactVersion": ARTIFACT_VERSION,
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": generated_at,
        "sourceUpdatedAt": source_updated_at,
        "rulingsSourceUpdatedAt": rulings_updated_at,
        "cardCount": card_count,
        "rulingsCount": rulings_count,
        "sets": sorted(allowed_sets) if allowed_sets is not None else None,
        "dbFormat": "sqlite",
        "databaseAssetName": database_path.name,
        "databaseChecksum": database_checksum.hexdigest(),
        "databaseCompressedBytes": database_path.stat().st_size,
        "databaseUncompressedBytes": database_uncompressed_bytes,
    }
    temporary_metadata_path = output_dir / f"metadata.json.{run_id}.tmp"
    temporary_metadata_path.write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_metadata_path.replace(output_dir / "metadata.json")
    print(
        f"Generated SQLite database with {card_count} cards and "
        f"{rulings_count} rulings in "
        f"{time.perf_counter() - generation_started_at:.2f}s at {database_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
