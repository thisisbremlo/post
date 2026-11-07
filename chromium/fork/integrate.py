#!/usr/bin/env python3
"""Copy the Post overlay into a Chromium checkout and register chrome://post.

Two existing files change: the WebUI config registry and its GN target. Both
edits are anchor-based and idempotent; when an anchor is missing the script
prints the edit it would have made instead of touching the file.

    python3 chromium/fork/integrate.py --src ~/chromium/src
    python3 chromium/fork/integrate.py --src ~/chromium/src --check
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OVERLAY = HERE / "overlay"
CONFIGS = Path("chrome/browser/ui/webui/chrome_web_ui_configs.cc")
WEBUI_GN = Path("chrome/browser/ui/webui/BUILD.gn")
MARKER = "// Post fork"

INCLUDE = '#include "chrome/browser/ui/webui/post/post_ui.h"\n'
REGISTER = (
    "  // Post fork: chrome://post is the desk, not a page in a tab.\n"
    "  map.AddWebUIConfig(std::make_unique<PostUIConfig>());\n"
)


def function_body(text: str, signature: str) -> tuple[int, int] | None:
    """Returns the (start, end) offsets of the braced body after signature."""
    start = text.find(signature)
    if start == -1:
        return None
    opening = text.find("{", start + len(signature))
    if opening == -1:
        return None
    depth = 0
    for offset in range(opening, len(text)):
        if text[offset] == "{":
            depth += 1
        elif text[offset] == "}":
            depth -= 1
            if depth == 0:
                return opening + 1, offset
    return None


def patch_configs(root: Path, check: bool) -> bool:
    path = root / CONFIGS
    if not path.exists():
        print(f"missing {path}; is --src a Chromium src directory?")
        return False
    text = path.read_text(encoding="utf-8")
    if MARKER in text:
        print("configs: already registered")
        return True

    body = function_body(text, "RegisterChromeWebUIConfigs(")
    if body is None:
        print("configs: could not find RegisterChromeWebUIConfigs(); add by hand:")
        print("  " + INCLUDE.strip())
        print("  " + REGISTER.strip())
        return False

    # The include block may start on line 1, so match lines rather than
    # searching for a preceding newline.
    includes = list(re.finditer(r"(?m)^#include [^\n]*\n", text))
    if not includes:
        print("configs: no include block found; add by hand: " + INCLUDE.strip())
        return False
    insert_at = includes[-1].end()

    patched = text[:insert_at] + INCLUDE + text[insert_at:]
    # The body offsets shift by the include we just added.
    body = function_body(patched, "RegisterChromeWebUIConfigs(")
    assert body is not None
    patched = patched[: body[1]] + REGISTER + patched[body[1] :]

    print(("would patch " if check else "patching ") + str(path))
    if not check:
        path.write_text(patched, encoding="utf-8")
    return True


def patch_gn(root: Path, check: bool) -> bool:
    path = root / WEBUI_GN
    if not path.exists():
        print(f"missing {path}")
        return False
    text = path.read_text(encoding="utf-8")
    if '"//chrome/browser/ui/webui/post"' in text:
        print("BUILD.gn: dependency already present")
        return True

    body = function_body(text, 'source_set("webui")')
    if body is None:
        print("BUILD.gn: no source_set(\"webui\") target; add the dependency by hand:")
        print('  "//chrome/browser/ui/webui/post",')
        return False

    start, end = body
    deps = text.find("deps = [", start, end)
    if deps == -1:
        # No deps yet: add one before the target's closing brace.
        patched = text[:end] + '\n  deps = [ "//chrome/browser/ui/webui/post" ]\n' + text[end:]
    else:
        closing = text.find("]", deps, end)
        if closing == -1:
            print("BUILD.gn: could not read the deps list; add it by hand.")
            return False
        # Insert on its own line, keeping the list's indentation intact.
        line_start = text.rfind("\n", deps, closing) + 1
        patched = (
            text[:line_start]
            + '    "//chrome/browser/ui/webui/post",\n'
            + text[line_start:]
        )

    print(("would patch " if check else "patching ") + str(path))
    if not check:
        path.write_text(patched, encoding="utf-8")
    return True


def copy_overlay(root: Path, check: bool) -> bool:
    copied = 0
    for source in OVERLAY.rglob("*"):
        if not source.is_file():
            continue
        target = root / source.relative_to(OVERLAY)
        copied += 1
        if check:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    print(f"{'would copy' if check else 'copied'} {copied} overlay files")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", required=True, type=Path, help="Chromium src directory")
    parser.add_argument("--check", action="store_true", help="print the edits, change nothing")
    args = parser.parse_args()

    root = args.src.expanduser().resolve()
    if not (root / "chrome" / "browser").is_dir():
        print(f"{root} does not look like a Chromium checkout")
        return 1

    grd = OVERLAY / "chrome/browser/ui/webui/post/resources/post_resources.grd"
    if not grd.exists():
        print("resources/post_resources.grd is missing; the overlay would not build.")
        print("Run `npm run fork:assets` first.")
        return 1

    results = [
        copy_overlay(root, args.check),
        patch_configs(root, args.check),
        patch_gn(root, args.check),
    ]

    if not all(results):
        print("\nSome edits need a hand; nothing was forced.")
        return 1

    print("\nNext:")
    print("  cd", root)
    print("  gn gen out/Post --args='is_debug=false is_component_build=false symbol_level=1'")
    print("  autoninja -C out/Post chrome")
    return 0


if __name__ == "__main__":
    sys.exit(main())
