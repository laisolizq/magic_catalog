#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
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

    raise RuntimeError("Unable to fetch data from Scryfall.")


def fetch_rulings(rulings_uri: str) -> list[dict[str, Any]]:
    """
    Fetch the rulings associated with a card using its ruling_uri.

    Scryfall returns an object like:

    {
        "object": "list",
        "data": [
            {
                "object": "ruling",
                "oracle_id": "...",
                "source": "wotc",
                "published_at": "2025-06-13",
                "comment": "..."
            }
        ]
    }
    """

    if not rulings_uri:
        return []

    payload = fetch_json_with_retries(rulings_uri)

    data = payload.get("data")

    if not isinstance(data, list):
        return []

    return [
        ruling
        for ruling in data
        if isinstance(ruling, dict)
    ]


def build_face_from_data(
    data: dict[str, Any],
    fallback_image_url: str = "",
    fallback_art_crop_url: str = "",
    fallback_colors: list[str] | None = None,
) -> dict[str, Any] | None:
    image_url = get_image_url(data, "normal") or fallback_image_url

    if not image_url:
        return None

    colors = safe_colors(data.get("colors"))

    if not colors and fallback_colors is not None:
        colors = fallback_colors

    art_crop_url = (
        get_image_url(data, "art_crop")
        or fallback_art_crop_url
        or image_url
    )

    face: dict[str, Any] = {
        "name": safe_string(data.get("name")),
        "manaCost": safe_string(data.get("mana_cost")),
        "typeLine": safe_string(data.get("type_line")),
        "oracleText": safe_string(data.get("oracle_text")),
        "colors": colors,
        "imageUrl": image_url,
        "artCropUrl": art_crop_url,
    }

    power = safe_string(data.get("power"))
    if power:
        face["power"] = power

    toughness = safe_string(data.get("toughness"))
    if toughness:
        face["toughness"] = toughness

    loyalty = safe_string(data.get("loyalty"))
    if loyalty:
        face["loyalty"] = loyalty

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
    card_image_url = get_image_url(card, "normal")
    card_art_crop_url = (
        get_image_url(card, "art_crop")
        or card_image_url
    )
    card_colors = safe_colors(card.get("colors"))

    if isinstance(card_faces, list) and card_faces:
        faces: list[dict[str, Any]] = []

        for raw_face in card_faces:
            if not isinstance(raw_face, dict):
                continue

            face = build_face_from_data(
                raw_face,
                fallback_image_url=card_image_url,
                fallback_art_crop_url=card_art_crop_url,
                fallback_colors=card_colors,
            )

            if face is not None:
                faces.append(face)

        return faces

    face = build_face_from_data(card)

    return [face] if face is not None else []


def to_mock_card(
    card: dict[str, Any],
    existing_cards: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
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

    card_id = f"{set_code}-{collector_number}"
    existing_card = existing_cards.get(card_id)

    if existing_card is not None:
        print(
            f"Skipping rulings fetch for {card_id} "
            "(already in mockCards)...",
            file=sys.stderr,
        )

        rulings = existing_card.get("rulings", [])
    else:
        ruling_uri = safe_string(card.get("rulings_uri"))

        print(
            f"Fetching rulings for {card_id}...",
            file=sys.stderr,
        )

        rulings = fetch_rulings(ruling_uri)

    return {
        "id": card_id,
        "rarity": rarity,
        "set": set_code,
        "rulings": rulings,
        "faces": faces,
    }


def load_existing_cards(
    output_path: Path,
) -> dict[str, dict[str, Any]]:
    """
    Parse the previously generated mockCards.ts file (if any) so we
    can reuse data already fetched from Scryfall, instead of making
    redundant API calls (namely rulings) for cards we already have.
    """

    if not output_path.exists():
        return {}

    text = output_path.read_text(encoding="utf-8")

    marker = "export const mockCards: Card[] = "
    marker_index = text.find(marker)

    if marker_index == -1:
        return {}

    array_text = text[marker_index + len(marker):].strip()

    # Turn the TS object literal array into valid JSON: quote the
    # unquoted keys and drop trailing commas before closing braces.
    array_text = re.sub(
        r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)',
        r'\1"\2"\3',
        array_text,
    )
    array_text = re.sub(r',(\s*[}\]])', r'\1', array_text)

    try:
        cards = json.loads(array_text)
    except json.JSONDecodeError:
        return {}

    if not isinstance(cards, list):
        return {}

    return {
        card["id"]: card
        for card in cards
        if isinstance(card, dict) and isinstance(card.get("id"), str)
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


def format_ruling(ruling: dict[str, Any]) -> str:
    """
    Format one Scryfall ruling as a TypeScript object.

    We keep the ruling object returned by Scryfall instead of
    reducing it to only the comment, so we don't lose information.
    """

    lines = ["      {"]

    for key, value in ruling.items():
        lines.append(
            f"        {key}: {quote(value)},"
        )

    lines.append("      },")

    return "\n".join(lines)


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
        lines.append(
            f"        power: {quote(face['power'])},"
        )

    if "toughness" in face:
        lines.append(
            f"        toughness: {quote(face['toughness'])},"
        )

    if "loyalty" in face:
        lines.append(
            f"        loyalty: {quote(face['loyalty'])},"
        )

    lines.append("      },")

    return "\n".join(lines)


def format_card(card: dict[str, Any]) -> str:
    lines = [
        "  {",
        f"    id: {quote(card['id'])},",
        f"    rarity: {quote(card['rarity'])},",
        f"    set: {quote(card['set'])},",
        "    rulings: [",
    ]

    for ruling in card["rulings"]:
        lines.append(format_ruling(ruling))

    lines.extend(
        [
            "    ],",
            "    faces: [",
        ]
    )

    for face in card["faces"]:
        lines.append(format_face(face))

    lines.extend(
        [
            "    ],",
            "  },",
        ]
    )

    return "\n".join(lines)


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
            "Download sets from Scryfall "
            "and generate mockCards.ts"
        )
    )

    parser.add_argument(
        "--sets",
        default="tla,hob,sos",
        help=(
            "Comma-separated Scryfall set codes "
            "(default: tla,hob,sos)"
        ),
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

    set_codes = [
        set_code.strip().lower()
        for set_code in args.sets.split(",")
        if set_code.strip()
    ]

    all_cards: list[dict[str, Any]] = []

    for set_code in set_codes:
        print(
            f"Downloading set {set_code}...",
            file=sys.stderr,
        )

        cards = fetch_all_cards(set_code)

        print(
            f"Found {len(cards)} cards in {set_code}.",
            file=sys.stderr,
        )

        all_cards.extend(cards)

    existing_cards = load_existing_cards(output_path)

    mock_cards = [
        card
        for card in (
            to_mock_card(card, existing_cards)
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