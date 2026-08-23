#!/usr/bin/env python3
"""Download the frozen `card-database-test` release into artifacts/card-database-test.

Skips the (large) SQLite download when a local copy already matches the
remote metadata's checksum, so repeated integration test runs stay fast.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

USER_AGENT = "magic_catalog/1.0 (fetch_test_database script)"
REQUEST_TIMEOUT_SECONDS = 60
RELEASE_BASE_URL = (
    "https://github.com/laisolizq/magic_catalog/releases/download/card-database-test"
)
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "artifacts" / "card-database-test"


def fetch_bytes(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return response.read()


def local_metadata(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    metadata_path = OUTPUT_DIR / "metadata.json"
    database_path = OUTPUT_DIR / "catalog.sqlite.gz"

    try:
        remote_metadata_bytes = fetch_bytes(f"{RELEASE_BASE_URL}/metadata.json")
    except (HTTPError, URLError, TimeoutError) as error:
        print(f"Failed to fetch test database metadata: {error}", file=sys.stderr)
        return 1

    remote_metadata = json.loads(remote_metadata_bytes.decode("utf-8"))
    existing_metadata = local_metadata(metadata_path)

    if (
        existing_metadata
        and database_path.exists()
        and existing_metadata.get("databaseChecksum") == remote_metadata.get("databaseChecksum")
    ):
        print(f"[fetch-test-database] up to date at {database_path}")
        return 0

    print("[fetch-test-database] downloading catalog.sqlite.gz (this may take a while)...")
    try:
        database_bytes = fetch_bytes(f"{RELEASE_BASE_URL}/catalog.sqlite.gz")
    except (HTTPError, URLError, TimeoutError) as error:
        print(f"Failed to fetch test database: {error}", file=sys.stderr)
        return 1

    database_path.write_bytes(database_bytes)
    metadata_path.write_bytes(remote_metadata_bytes)
    print(f"[fetch-test-database] saved to {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
