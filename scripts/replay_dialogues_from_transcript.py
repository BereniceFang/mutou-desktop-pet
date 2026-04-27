"""Replay content/dialogues/* from Cursor transcript: main.json patches → split → bundle patches."""
from __future__ import annotations

import json
import re
from pathlib import Path

TRANSCRIPT = Path(
    "/Users/berenice/.cursor/projects/Users-berenice-wood/agent-transcripts/"
    "ab02484c-5a75-4b71-a7e4-0769e301451f/ab02484c-5a75-4b71-a7e4-0769e301451f.jsonl"
)
DIALOGUES = "/Users/berenice/wood/mutou-desktop-pet/content/dialogues"
MAIN_PATH = f"{DIALOGUES}/main.json"
OUT_DIR = Path("/Users/berenice/wood/mutou-desktop-pet/content/dialogues")


def split_patch_files(patch: str) -> list[tuple[str, str, str]]:
    patch = patch.strip()
    if not patch.startswith("*** Begin Patch") or not patch.endswith("*** End Patch"):
        raise ValueError("Malformed patch wrapper")
    inner = patch[len("*** Begin Patch") : -len("*** End Patch")].strip("\n")
    chunks = re.split(r"\n(?=\*\*\* (?:Add|Update) File:)", inner)
    out: list[tuple[str, str, str]] = []
    for ch in chunks:
        ch = ch.strip("\n")
        if not ch:
            continue
        first, _, rest = ch.partition("\n")
        m_add = re.match(r"^\*\*\* Add File: (.+)$", first)
        m_upd = re.match(r"^\*\*\* Update File: (.+)$", first)
        if m_add:
            out.append(("add", m_add.group(1).strip(), rest))
        elif m_upd:
            out.append(("update", m_upd.group(1).strip(), rest))
        else:
            raise ValueError(f"Unknown patch chunk start: {first!r}")
    return out


def content_from_add_body(body: str) -> str:
    lines: list[str] = []
    for line in body.split("\n"):
        if line.startswith("+"):
            lines.append(line[1:])
        else:
            raise ValueError(f"Unexpected line in Add body: {line!r}")
    return "\n".join(lines) + "\n"


def parse_hunk_lines(hunk_body: str) -> list[list[str]]:
    parts = re.split(r"^@@\s*$", hunk_body, flags=re.MULTILINE)
    hunks: list[list[str]] = []
    for p in parts:
        p = p.strip("\n")
        if not p:
            continue
        hunks.append(p.split("\n"))
    return hunks


def hunk_to_old_new(raw: list[str]) -> tuple[list[str], list[str]]:
    old: list[str] = []
    new: list[str] = []
    for line in raw:
        if line.startswith("@@"):
            continue
        if not line:
            old.append("")
            new.append("")
            continue
        op = line[0]
        text = line[1:]
        if op == " ":
            old.append(text)
            new.append(text)
        elif op == "-":
            old.append(text)
        elif op == "+":
            new.append(text)
        else:
            old.append(line)
            new.append(line)
    return old, new


def apply_hunk(lines: list[str], raw: list[str]) -> list[str]:
    old_seq, new_seq = hunk_to_old_new(raw)
    if not old_seq:
        raise ValueError("Empty old_seq in hunk")
    n, m = len(lines), len(old_seq)
    for i in range(n - m + 1):
        if lines[i : i + m] == old_seq:
            return lines[:i] + new_seq + lines[i + m :]
    preview = "\n".join(old_seq[:8])
    raise ValueError(f"Hunk did not apply; expected:\n{preview}\n...")


def apply_update(path: str, body: str, files: dict[str, str]) -> None:
    text = files[path]
    lines = text.split("\n")
    for hunk in parse_hunk_lines(body):
        lines = apply_hunk(lines, hunk)
    files[path] = "\n".join(lines) + ("\n" if text.endswith("\n") or not text else "")


def process_apply_patch(patch_input: str, files: dict[str, str], split_done: bool) -> None:
    for kind, path_str, body in split_patch_files(patch_input):
        if not path_str.startswith(DIALOGUES + "/"):
            continue
        if not split_done and path_str != MAIN_PATH:
            continue
        if split_done and path_str == MAIN_PATH:
            continue
        if kind == "add":
            files[path_str] = content_from_add_body(body)
        else:
            if path_str not in files:
                raise FileNotFoundError(f"Update before add: {path_str} (line {line_no})")
            apply_update(path_str, body, files)


def bucket_for_type(t: str) -> str:
    if t in (
        "interaction",
        "interaction_repeat",
        "interaction_double",
        "interaction_long_press",
        "interaction_context_menu",
        "interaction_comfort",
        "interaction_comfort_light",
        "interaction_comfort_heavy",
    ):
        return "interaction.json"
    if t in (
        "idle",
        "idle_comfort",
        "idle_morning",
        "idle_noon",
        "idle_afternoon",
        "idle_evening",
        "idle_night",
    ):
        return "idle.json"
    if (
        t.startswith("feed_")
        or t.startswith("focus_")
        or t == "idle_hunger_hint"
        or t == "interaction_hunger_hint"
    ):
        return "care.json"
    if (
        t.startswith("idle_holiday_")
        or t.startswith("interaction_holiday_")
        or t == "idle_personal_milestone"
        or t == "interaction_personal_milestone"
    ):
        return "seasonal.json"
    raise ValueError(f"Unmapped dialogue type: {t}")


def split_main_into_bundles(files: dict[str, str]) -> None:
    raw = files.pop(MAIN_PATH, None)
    if raw is None:
        raise SystemExit("No main.json to split")
    data = json.loads(raw)
    dialogues = data.get("dialogues", [])
    buckets: dict[str, list] = {
        f"{DIALOGUES}/interaction.json": [],
        f"{DIALOGUES}/idle.json": [],
        f"{DIALOGUES}/care.json": [],
        f"{DIALOGUES}/seasonal.json": [],
    }
    for line in dialogues:
        bname = bucket_for_type(line["type"])
        key = f"{DIALOGUES}/{bname}"
        buckets[key].append(line)
    for path, lines in buckets.items():
        files[path] = json.dumps({"dialogues": lines}, ensure_ascii=False, indent=2) + "\n"
    files[f"{DIALOGUES}/index.json"] = (
        json.dumps(
            {"bundles": ["interaction.json", "idle.json", "care.json", "seasonal.json"]},
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )


def is_split_shell(inp: dict) -> bool:
    cmd = inp.get("command", "")
    return isinstance(cmd, str) and "bucketForType" in cmd and "main.json" in cmd


def main() -> None:
    files: dict[str, str] = {}
    split_done = False

    with TRANSCRIPT.open(encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            if rec.get("role") != "assistant":
                continue
            for block in rec.get("message", {}).get("content") or []:
                if not isinstance(block, dict) or block.get("type") != "tool_use":
                    continue
                name = block.get("name")
                inp = block.get("input")

                if name == "Shell" and isinstance(inp, dict) and is_split_shell(inp):
                    split_main_into_bundles(files)
                    split_done = True
                    print(f"Split at transcript line {line_no}")
                    continue

                if name == "Delete" and isinstance(inp, dict):
                    p = inp.get("path", "")
                    if p == MAIN_PATH:
                        files.pop(MAIN_PATH, None)
                    continue

                if name == "ApplyPatch" and isinstance(inp, str):
                    if DIALOGUES not in inp:
                        continue
                    process_apply_patch(inp, files, split_done)
                    continue

                if name == "StrReplace" and isinstance(inp, dict):
                    p = inp.get("path", "")
                    old = inp.get("old_string")
                    new = inp.get("new_string")
                    if not isinstance(p, str) or not p.startswith(DIALOGUES + "/"):
                        continue
                    if not split_done and p != MAIN_PATH:
                        continue
                    if split_done and p == MAIN_PATH:
                        continue
                    if not isinstance(old, str) or not isinstance(new, str):
                        continue
                    if p not in files:
                        raise FileNotFoundError(f"StrReplace missing {p} at line {line_no}")
                    text = files[p]
                    if old not in text and p == MAIN_PATH:
                        alt = old.replace(
                            '"id": "feed_repeat_002",\n      "type": "feed_repeat",\n      "text": "再喂下去我就要抱着{food}一起对你撒娇了，先让我慢慢吃完。",\n      "expressionHint": "happy",',
                            '"id": "feed_repeat_002",\n      "type": "feed_repeat",\n      "text": "再喂下去我就要抱着{food}一起对你撒娇了，先让我慢慢吃完。",\n      "expressionHint": "smile",',
                        )
                        if alt in text:
                            old = alt
                    if old not in text:
                        raise ValueError(f"StrReplace old not in {p} at line {line_no}")
                    files[p] = text.replace(old, new, 1)

    if not split_done:
        raise SystemExit("Transcript never ran split shell; cannot produce bundles")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for rel in ["index.json", "interaction.json", "idle.json", "care.json", "seasonal.json"]:
        path = f"{DIALOGUES}/{rel}"
        if path not in files:
            raise SystemExit(f"Missing output {rel}")
        OUT_DIR.joinpath(rel).write_text(files[path], encoding="utf-8")
        obj = json.loads(files[path])
        print(f"Wrote {rel}: {len(obj.get('dialogues', []))} dialogues")

    if MAIN_PATH in files:
        print("Warning: main.json still in memory")


if __name__ == "__main__":
    main()
