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


def first_face_with_image(card: dict[str, Any]) -> dict[str, Any] | None:
    card_faces = card.get("card_faces")
    if not isinstance(card_faces, list):
        return None

    for face in card_faces:
        if isinstance(face, dict) and isinstance(face.get("image_uris"), dict):
            if safe_string(face["image_uris"].get("normal")):
                return face

    return None


def build_oracle_text(card: dict[str, Any]) -> str:
    oracle_text = safe_string(card.get("oracle_text"))
    if oracle_text:
        return oracle_text

    card_faces = card.get("card_faces")
    if not isinstance(card_faces, list):
        return ""

    parts: list[str] = []
    for face in card_faces:
        if isinstance(face, dict):
            text = safe_string(face.get("oracle_text"))
            if text:
                parts.append(text)

    return " // ".join(parts)


def to_mock_card(card: dict[str, Any]) -> dict[str, Any] | None:
    face_with_image = first_face_with_image(card)
    image_url = safe_string(card.get("image_uris", {}).get("normal"))
    if not image_url and face_with_image:
        image_url = safe_string(face_with_image.get("image_uris", {}).get("normal"))

    if not image_url:
        return None

    art_crop_url = safe_string(card.get("image_uris", {}).get("art_crop"))
    if not art_crop_url and face_with_image:
        art_crop_url = safe_string(face_with_image.get("image_uris", {}).get("art_crop"))
    if not art_crop_url:
        art_crop_url = image_url

    rarity = safe_string(card.get("rarity"))
    if rarity not in VALID_RARITIES:
        rarity = "common"

    colors_raw = card.get("colors")
    colors = []
    if isinstance(colors_raw, list):
        colors = [color for color in colors_raw if isinstance(color, str) and color in VALID_COLORS]

    first_face = None
    card_faces = card.get("card_faces")
    if isinstance(card_faces, list) and card_faces and isinstance(card_faces[0], dict):
        first_face = card_faces[0]

    power = safe_string(card.get("power"))
    if not power and first_face:
        power = safe_string(first_face.get("power"))

    toughness = safe_string(card.get("toughness"))
    if not toughness and first_face:
        toughness = safe_string(first_face.get("toughness"))

    mock_card: dict[str, Any] = {
        "id": f"{safe_string(card.get('set'))}-{safe_string(card.get('collector_number'))}",
        "name": safe_string(card.get("name")),
        "manaCost": safe_string(card.get("mana_cost")),
        "typeLine": safe_string(card.get("type_line")),
        "oracleText": build_oracle_text(card),
        "set": safe_string(card.get("set")),
        "rarity": rarity,
        "colors": colors,
        "imageUrl": image_url,
        "artCropUrl": art_crop_url,
    }

    if power:
        mock_card["power"] = power

    if toughness:
        mock_card["toughness"] = toughness

    return mock_card


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


def format_card(card: dict[str, Any]) -> str:
    lines = [
        "  {",
        f"    id: {quote(card['id'])},",
        f"    name: {quote(card['name'])},",
        f"    manaCost: {quote(card['manaCost'])},",
        f"    typeLine: {quote(card['typeLine'])},",
    ]

    if "power" in card:
        lines.append(f"    power: {quote(card['power'])},")

    if "toughness" in card:
        lines.append(f"    toughness: {quote(card['toughness'])},")

    lines.extend(
        [
            f"    oracleText: {quote(card['oracleText'])},",
            f"    set: {quote(card['set'])},",
            f"    rarity: {quote(card['rarity'])},",
            "    colors: [" + ", ".join(quote(color) for color in card["colors"]) + "],",
            f"    imageUrl: {quote(card['imageUrl'])},",
            f"    artCropUrl: {quote(card['artCropUrl'])},",
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
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                payload = response.read().decode("utf-8")
            return json.loads(payload)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            if attempt == MAX_RETRIES:
                raise

            print(
                f"Request failed (attempt {attempt}/{MAX_RETRIES}). Retrying: {error}",
                file=sys.stderr,
            )
            time.sleep(1.5)

    raise RuntimeError("Unable to fetch cards from Scryfall.")


def fetch_all_cards(set_code: str) -> list[dict[str, Any]]:
    query = f"https://api.scryfall.com/cards/search?order=set&q=e:{set_code}&unique=prints"
    cards: list[dict[str, Any]] = []
    next_url: str | None = query

    while next_url:
        payload = fetch_json_with_retries(next_url)

        data = payload.get("data")
        if isinstance(data, list):
            cards.extend(item for item in data if isinstance(item, dict))

        has_more = bool(payload.get("has_more"))
        next_page = payload.get("next_page")
        next_url = next_page if has_more and isinstance(next_page, str) else None

    return cards


def write_mock_cards_file(cards: list[dict[str, Any]], output_path: Path) -> None:
    generated_at = datetime.now(timezone.utc).isoformat()
    body_lines = [
        "import type { Card } from '../types/card'",
        "",
        f"// Generated by scripts/download_tla_set.py on {generated_at}",
        "export const mockCards: Card[] = [",
    ]

    body_lines.extend(format_card(card) for card in cards)
    body_lines.extend([
        "]",
        "",
    ])

    output_path.write_text("\n".join(body_lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download a set from Scryfall and generate mockCards.ts")
    parser.add_argument("--set", default="tla", help="Scryfall set code (default: tla)")
    parser.add_argument(
        "--output",
        default="src/data/mockCards.ts",
        help="Output TypeScript file path (default: src/data/mockCards.ts)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    root_dir = Path(__file__).resolve().parent.parent
    output_path = (root_dir / args.output).resolve()

    all_cards = fetch_all_cards(args.set.lower())
    mock_cards = [card for card in (to_mock_card(card) for card in all_cards) if card is not None]
    mock_cards.sort(key=collector_sort_key)

    write_mock_cards_file(mock_cards, output_path)

    print(f"Saved {len(mock_cards)} cards to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
