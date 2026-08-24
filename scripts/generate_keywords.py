import json
import re
import sys
import urllib.request
from pathlib import Path


RULES_URL = (
    "https://media.wizards.com/2026/downloads/"
    "MagicCompRules%2020260819.txt"
)

OUTPUT_FILES = {
    "abilities": "keyword-abilities.json",
    "actions": "keyword-actions.json",
}

SECTION_NAMES = {
    "abilities": "Keyword Abilities",
    "actions": "Keyword Actions",
}

SECTION_NUMBERS = {
    "abilities": 702,
    "actions": 701,
}

USER_AGENT = "Cardscade/1.0"


def fetch_rules() -> list[str]:
    print(
        f"Fetching: {RULES_URL}"
    )

    request = urllib.request.Request(
        RULES_URL,
        headers={
            "User-Agent": USER_AGENT,
        },
    )

    with urllib.request.urlopen(request) as response:
        text = response.read().decode(
            "utf-8-sig"
        )

    return text.splitlines()


def extract_section(
    lines: list[str],
    section_number: int,
    keyword_type: str,
) -> list[str]:
    """
    Extract the actual 701 or 702 section.

    The section name appears in the document twice:
      - once in the table of contents
      - once in the actual rules

    We therefore search from the end of the file
    and use the last occurrence.
    """

    section_name = SECTION_NAMES[
        keyword_type
    ]

    section_title = (
        f"{section_number}. "
        f"{section_name}"
    )

    start_index = None

    for index in range(
        len(lines) - 1,
        -1,
        -1,
    ):
        if lines[index].strip() == section_title:
            start_index = index + 1
            break

    if start_index is None:
        raise RuntimeError(
            f"Could not find section "
            f"{section_title}"
        )

    result = []

    next_section_pattern = re.compile(
        r"^(\d+)\.\s+(.+)$"
    )

    for line in lines[start_index:]:
        stripped = line.strip()

        match = next_section_pattern.match(
            stripped
        )

        if match:
            number = int(match.group(1))

            # Stop when the next major rules
            # section begins.
            #
            # 701 -> stop at 702
            # 702 -> stop at 703
            if number > section_number:
                break

        result.append(line)

    return result


def normalize_whitespace(
    text: str,
) -> str:
    """
    Collapse multiple whitespace characters into
    a single space.
    """

    return re.sub(
        r"\s+",
        " ",
        text,
    ).strip()


def extract_entries(
    section_lines: list[str],
    section_number: int,
) -> list[dict[str, str]]:
    """
    Extract keyword entries from section 701 or 702.

    Example:

        702.2. Deathtouch
        702.2a Deathtouch is a static ability.
        702.2b ...

    becomes:

        {
            "name": "Deathtouch",
            "description": "Deathtouch is a static ability."
        }

    The first subrule (a) is used as the main
    description shown in the app.

    Rules 701.1 and 702.1 are introductory rules,
    not keyword entries, so they are ignored.
    """

    # Example:
    #
    # 702.2. Deathtouch
    #
    entry_pattern = re.compile(
        rf"^{section_number}\."
        r"(\d+)\.\s+(.+)$"
    )

    # Example:
    #
    # 702.2a Deathtouch is a static ability.
    #
    subrule_pattern = re.compile(
        rf"^{section_number}\."
        r"(\d+)([a-z]+)\s+(.+)$"
    )

    entries = []

    current_entry = None
    current_description = []

    def save_entry():
        nonlocal current_entry
        nonlocal current_description

        if current_entry is None:
            return

        description = normalize_whitespace(
            " ".join(current_description)
        )

        if description:
            current_entry["description"] = (
                description
            )

            entries.append(current_entry)

        current_entry = None
        current_description = []

    for line in section_lines:
        stripped = line.strip()

        if not stripped:
            continue

        # ---------------------------------
        # New keyword entry
        # ---------------------------------

        entry_match = entry_pattern.match(
            stripped
        )

        if entry_match:
            save_entry()

            entry_number = int(
                entry_match.group(1)
            )

            name = entry_match.group(2).strip()

            # ---------------------------------
            # 701.1 / 702.1 are introductory
            # rules, NOT keyword entries.
            # ---------------------------------

            if entry_number == 1:
                current_entry = None
                current_description = []
                continue

            current_entry = {
                "name": name,
                "description": "",
            }

            current_description = []

            continue

        # ---------------------------------
        # Subrule
        # ---------------------------------

        subrule_match = subrule_pattern.match(
            stripped
        )

        if (
            subrule_match
            and current_entry is not None
        ):
            letter = subrule_match.group(2)
            text = subrule_match.group(3)

            # Only the first subrule is used as
            # the short definition.
            if letter == "a":
                current_description = [
                    text
                ]

            continue

        # ---------------------------------
        # Continuation of the description
        # ---------------------------------

        if (
            current_entry is not None
            and current_description
        ):
            current_description.append(
                stripped
            )

    # Save the final entry.
    save_entry()

    return entries


def write_json(
    keyword_type: str,
    entries: list[dict[str, str]],
):
    """
    Write the generated JSON to src/data.
    """

    output_file = (
        Path(__file__).resolve().parent.parent
        / "src"
        / "data"
        / OUTPUT_FILES[keyword_type]
    )

    output_file.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_file.write_text(
        json.dumps(
            entries,
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        f"Generated: {output_file}"
    )


def generate(
    keyword_type: str,
    rules_lines: list[str],
):
    """
    Generate one keyword dataset.
    """

    section_number = SECTION_NUMBERS[
        keyword_type
    ]

    section_name = SECTION_NAMES[
        keyword_type
    ]

    print()
    print(
        f"Extracting {section_number}. "
        f"{section_name}..."
    )

    section_lines = extract_section(
        rules_lines,
        section_number,
        keyword_type,
    )

    print(
        f"Section contains "
        f"{len(section_lines)} lines."
    )

    entries = extract_entries(
        section_lines,
        section_number,
    )

    write_json(
        keyword_type,
        entries,
    )

    print(
        f"Found {len(entries)} "
        f"{keyword_type}."
    )


def main():
    if len(sys.argv) != 2:
        print("Usage:")
        print()
        print(
            "  python3 "
            "scripts/generate_keywords.py "
            "abilities"
        )
        print()
        print(
            "  python3 "
            "scripts/generate_keywords.py "
            "actions"
        )
        print()

        sys.exit(1)

    keyword_type = sys.argv[1].lower()

    if keyword_type not in SECTION_NUMBERS:
        print(
            "ERROR: Invalid type."
        )
        print(
            "Use 'abilities' or 'actions'."
        )

        sys.exit(1)

    print()
    print(
        "=== Cardscade - Generate Keywords ==="
    )
    print()

    # ---------------------------------
    # Download the Comprehensive Rules
    # ---------------------------------

    rules_lines = fetch_rules()

    print(
        f"Downloaded {len(rules_lines)} lines."
    )

    # ---------------------------------
    # Generate requested dataset
    # ---------------------------------

    generate(
        keyword_type,
        rules_lines,
    )

    print()
    print("Done!")
    print()


if __name__ == "__main__":
    main()