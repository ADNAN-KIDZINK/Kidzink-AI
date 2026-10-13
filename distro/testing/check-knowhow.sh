#!/usr/bin/env bash
# Checks everything in distro/ that ships with the app, without an API key:
#   1. every skill in distro/skills is discovered by goose (a bad SKILL.md header is silently skipped)
#   2. every recipe in distro/recipes passes `goose recipe validate`
#   3. the skill helper scripts build Word, Excel and PowerPoint files and read a PDF
# Usage: distro/testing/check-knowhow.sh   (needs a goose build in target/release or target/debug)
set -euo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
goose="$repo/target/release/goose"
[ -x "$goose" ] || goose="$repo/target/debug/goose"
[ -x "$goose" ] || { echo "Build goose first (cargo build -p goose-cli)." >&2; exit 1; }

work="$(mktemp -d)"
trap 'chmod -R u+w "$work" 2>/dev/null; rm -rf "$work"' EXIT
mkdir -p "$work/home" "$work/root/config/skills"
cp -R "$repo/distro/skills/." "$work/root/config/skills/"
failed=0

echo "== Skills"
listed="$(cd "$work" && HOME="$work/home" GOOSE_PATH_ROOT="$work/root" "$goose" skills list 2>/dev/null)"
for dir in "$repo"/distro/skills/*/; do
  name="$(basename "$dir")"
  if printf '%s\n' "$listed" | grep -qE "^$name +\|"; then
    echo "ok    $name"
  else
    echo "FAIL  $name is not discovered (check its SKILL.md header)"
    failed=1
  fi
done

echo "== Recipes"
for recipe in "$repo"/distro/recipes/*.yaml; do
  if HOME="$work/home" GOOSE_PATH_ROOT="$work/root" "$goose" recipe validate "$recipe" >/dev/null 2>&1; then
    echo "ok    $(basename "$recipe")"
  else
    echo "FAIL  $(basename "$recipe")"
    failed=1
  fi
done

echo "== Helper scripts (first run downloads Python; may take a minute)"
# A persistent root, so the Python runtime is downloaded once rather than on every run.
export PATH="$repo/ui/desktop/src/bin:$repo/distro/launchers:$PATH"
export GOOSE_PATH_ROOT="${KZ_CHECK_CACHE:-$HOME/.cache/kidzink-ai-check}"
skills="$repo/distro/skills"
cd "$work"
printf '# Title\n\nIntro with **bold** & [to confirm].\n\n## Section\n\n- point\n\n| A | B |\n|---|---|\n| 1 | 2 |\n' > doc.md
echo '{"currency":"AED","sheets":[{"name":"S","columns":[{"header":"Item"},{"header":"Cost","type":"currency"}],"rows":[["x",1]],"total_row":{"label":"Total","sum":["Cost"]}}]}' > sheet.json
echo '{"title":"T","slides":[{"type":"bullets","title":"B","bullets":["a"]},{"type":"table","title":"C","columns":["A"],"rows":[["1"]]}]}' > deck.json
printf 'Quote\nDesks 40\n' > quote.txt
run() {
  local label="$1"; shift
  if "$@" >"$work/out.log" 2>&1; then echo "ok    $label"; else echo "FAIL  $label"; tail -5 "$work/out.log"; failed=1; fi
}
run "make_docx"        kz-python "$skills/word-documents/scripts/make_docx.py" doc.md out.docx
run "read_docx"        kz-python "$skills/word-documents/scripts/read_docx.py" out.docx
run "make_xlsx"        kz-python "$skills/excel-spreadsheets/scripts/make_xlsx.py" sheet.json out.xlsx
run "inspect_data"     kz-python "$skills/excel-spreadsheets/scripts/inspect_data.py" out.xlsx
run "make_pptx"        kz-python "$skills/powerpoint-slides/scripts/make_pptx.py" deck.json out.pptx
if command -v cupsfilter >/dev/null 2>&1 && cupsfilter quote.txt >quote.pdf 2>/dev/null; then
  run "read_pdf"       kz-python "$skills/pdf-files/scripts/read_pdf.py" quote.pdf --tables
fi

[ "$failed" -eq 0 ] && echo "All checks passed." || { echo "Some checks failed."; exit 1; }
