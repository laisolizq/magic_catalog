#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

USER_AGENT = "magic_catalog/1.0 (download_tla_set script)"
REQUEST_TIMEOUT_SECONDS = 30
MAX_RETRIES = 4

VALID_RARITIES = {"common", "uncommon", "rare", "mythic"}
VALID_COLORS = {"W", "U", "B", "R", "G"}


def safe_string(value: Any) -> str:
    return value if isinstance(value, str) else ""


def safe_colors(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    return [
        color
        for color in value
        if isinstance(color, str) and color in VALID_COLORS
    ]


def get_image_url(data: dict[str, Any], key: str) -> str:
    image_uris = data.get("image_uris")

    if not isinstance(image_uris, dict):
        return ""

    return safe_string(image_uris.get(key))


def build_face_from_data(data: dict[str, Any]) -> dict[str, Any] | None:
    image_url = get_image_url(data, "normal")

    if not image_url:
        return None

    face: dict[str, Any] = {
        "name": safe_string(data.get("name")),
        "manaCost": safe_string(data.get("mana_cost")),
        "typeLine": safe_string(data.get("type_line")),
        "oracleText": safe_string(data.get("oracle_text")),
        "colors": safe_colors(data.get("colors")),
        "imageUrl": image_url,
        "artCropUrl": get_image_url(data, "art_crop") or image_url,
    }

    power = safe_string(data.get("power"))
    if power:
        face["power"] = power

    toughness = safe_string(data.get("toughness"))
    if toughness:
        face["toughness"] = toughness

    return face


def build_faces(card: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Build a normalized faces array.

    - Normal cards don't have card_faces, so we create one face
      from the card itself.
    - Double-faced cards have card_faces, so we create one face
      for every entry.
    """

    card_faces = card.get("card_faces")

    if isinstance(card_faces, list) and card_faces:
        faces: list[dict[str, Any]] = []

        for raw_face in card_faces:
            if not isinstance(raw_face, dict):
                continue

            face = build_face_from_data(raw_face)

            if face is not None:
                faces.append(face)

        return faces

    face = build_face_from_data(card)

    return [face] if face is not None else []


def to_mock_card(card: dict[str, Any]) -> dict[str, Any] | None:
    set_code = safe_string(card.get("set"))
    collector_number = safe_string(card.get("collector_number"))

    if not set_code or not collector_number:
        return None

    faces = build_faces(card)

    if not faces:
        return None

    rarity = safe_string(card.get("rarity"))

    if rarity not in VALID_RARITIES:
        rarity = "common"

    return {
        "id": f"{set_code}-{collector_number}",
        "rarity": rarity,
        "set": set_code,
        "faces": faces,
    }


def collector_sort_key(card: dict[str, Any]) -> tuple[str, int, str]:
    card_id = safe_string(card.get("id"))
    set_code, _, collector = card_id.partition("-")

    digits = ""
    suffix = ""

    for index, char in enumerate(collector):
        if char.isdigit():
            digits += char
        else:
            suffix = collector[index:]
            break

    collector_number = int(digits) if digits else 0

    return set_code, collector_number, suffix.lower()


def quote(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True)


def format_face(face: dict[str, Any]) -> str:
    lines = [
        "      {",
        f"        name: {quote(face['name'])},",
        f"        manaCost: {quote(face['manaCost'])},",
        f"        typeLine: {quote(face['typeLine'])},",
        f"        oracleText: {quote(face['oracleText'])},",
        "        colors: ["
        + ", ".join(quote(color) for color in face["colors"])
        + "],",
        f"        imageUrl: {quote(face['imageUrl'])},",
        f"        artCropUrl: {quote(face['artCropUrl'])},",
    ]

    if "power" in face:
        lines.append(f"        power: {quote(face['power'])},")

    if "toughness" in face:
        lines.append(f"        toughness: {quote(face['toughness'])},")

    lines.append("      },")

    return "\n".join(lines)


def format_card(card: dict[str, Any]) -> str:
    lines = [
        "  {",
        f"    id: {quote(card['id'])},",
        f"    rarity: {quote(card['rarity'])},",
        f"    set: {quote(card['set'])},",
        "    faces: [",
    ]

    for face in card["faces"]:
        lines.append(format_face(face))

    lines.extend(
        [
            "    ],",
            "  },",
        ]
    )

    return "\n".join(lines)


def fetch_json_with_retries(url: str) -> dict[str, Any]:
    for attempt in range(1, MAX_RETRIES + 1):
        request = Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
        )

        try:
            with urlopen(
                request,
                timeout=REQUEST_TIMEOUT_SECONDS,
            ) as response:
                payload = response.read().decode("utf-8")

            return json.loads(payload)

        except (
            HTTPError,
            URLError,
            TimeoutError,
            json.JSONDecodeError,
        ) as error:
            if attempt == MAX_RETRIES:
                raise

            print(
                f"Request failed "
                f"(attempt {attempt}/{MAX_RETRIES}). "
                f"Retrying: {error}",
                file=sys.stderr,
            )

            time.sleep(1.5)

    raise RuntimeError("Unable to fetch cards from Scryfall.")


def fetch_all_cards(set_code: str) -> list[dict[str, Any]]:
    query = (
        "https://api.scryfall.com/cards/search"
        f"?order=set&q=e:{set_code}&unique=prints"
    )

    cards: list[dict[str, Any]] = []
    next_url: str | None = query

    while next_url:
        payload = fetch_json_with_retries(next_url)

        data = payload.get("data")

        if isinstance(data, list):
            cards.extend(
                item
                for item in data
                if isinstance(item, dict)
            )

        has_more = bool(payload.get("has_more"))
        next_page = payload.get("next_page")

        next_url = (
            next_page
            if has_more and isinstance(next_page, str)
            else None
        )

    return cards


def write_mock_cards_file(
    cards: list[dict[str, Any]],
    output_path: Path,
) -> None:
    generated_at = datetime.now(timezone.utc).isoformat()

    body_lines = [
        "import type { Card } from '../types/card'",
        "",
        f"// Generated by scripts/download_tla_set.py on {generated_at}",
        "export const mockCards: Card[] = [",
    ]

    body_lines.extend(
        format_card(card)
        for card in cards
    )

    body_lines.extend(
        [
            "]",
            "",
        ]
    )

    output_path.write_text(
        "\n".join(body_lines),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Download a set from Scryfall "
            "and generate mockCards.ts"
        )
    )

    parser.add_argument(
        "--set",
        default="tla",
        help="Scryfall set code (default: tla)",
    )

    parser.add_argument(
        "--output",
        default="src/data/mockCards.ts",
        help=(
            "Output TypeScript file path "
            "(default: src/data/mockCards.ts)"
        ),
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    root_dir = Path(__file__).resolve().parent.parent

    output_path = (
        root_dir / args.output
    ).resolve()

    all_cards = fetch_all_cards(
        args.set.lower()
    )

    mock_cards = [
        card
        for card in (
            to_mock_card(card)
            for card in all_cards
        )
        if card is not None
    ]

    mock_cards.sort(
        key=collector_sort_key
    )

    write_mock_cards_file(
        mock_cards,
        output_path,
    )

    print(
        f"Saved {len(mock_cards)} cards "
        f"to {output_path}"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())