#!/usr/bin/env bash
# Builds Post's Chromium fork on macOS: source, overlay, build, launch.
#
#   npm run fork:build
#   POST_CHROMIUM_SRC=~/src/chromium scripts/fork-macos.sh --skip-sync
#
# First run downloads tens of gigabytes and compiles for hours. Later runs are
# incremental. The C++ has not been compiled in the authoring environment yet;
# the first autoninja is expected to stop with a few API or GN errors.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${POST_CHROMIUM_SRC:-$HOME/chromium/src}"
OPEN_AFTER=1
SKIP_SYNC=0

for argument in "$@"; do
  case "$argument" in
    --no-open) OPEN_AFTER=0 ;;
    --skip-sync) SKIP_SYNC=1 ;;
    -h|--help)
      sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $argument"
      exit 2
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script builds the macOS app. On another system, use chromium/docs/build.md."
  exit 1
fi

if ! xcode-select -p >/dev/null 2>&1; then
  echo "Xcode is not selected. Install Xcode 16, then run:"
  echo "  sudo xcode-select --switch /Applications/Xcode.app"
  echo "  sudo xcodebuild -license accept"
  exit 1
fi

if ! command -v fetch >/dev/null 2>&1; then
  echo "depot_tools is not on PATH. Install it once:"
  echo '  git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git "$HOME/depot_tools"'
  echo '  export PATH="$HOME/depot_tools:$PATH"'
  echo "Then run this script again."
  exit 1
fi

FREE_GB="$(df -g "$HOME" | awk 'NR==2 {print $4}')"
if [[ "${FREE_GB:-0}" -lt 120 ]]; then
  echo "Only ${FREE_GB} GB free where $HOME lives; a Chromium build needs about 120 GB."
  exit 1
fi

if [[ ! -d "$SRC" ]]; then
  echo "Fetching Chromium into $(dirname "$SRC") — tens of gigabytes, once."
  mkdir -p "$(dirname "$SRC")"
  (cd "$(dirname "$SRC")" && fetch --nohooks chromium)
fi

cd "$SRC"
if [[ "$SKIP_SYNC" -eq 0 ]]; then
  echo "Syncing the checkout and its toolchain…"
  gclient sync -D
fi

echo "Building the desk into the overlay…"
cd "$ROOT"
npm run fork:assets

echo "Applying the overlay to $SRC…"
python3 chromium/fork/integrate.py --src "$SRC"

cd "$SRC"
echo "Generating the build files…"
gn gen out/Post --args='is_debug=false is_component_build=false symbol_level=1'

echo "Building chrome — this is the long part…"
autoninja -C out/Post chrome

if [[ "$OPEN_AFTER" -eq 1 ]]; then
  echo "Opening Post at chrome://post"
  open -a "$SRC/out/Post/Chromium.app" --args "chrome://post"
fi
