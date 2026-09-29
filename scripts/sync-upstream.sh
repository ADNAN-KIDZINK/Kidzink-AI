#!/usr/bin/env bash
# Kidzink AI: merge upstream goose into our distribution branch.
#
# Usage: scripts/sync-upstream.sh [--check] [--verify] [--branch <name>]
#   --check    preview only: report incoming commits and predicted conflicts, change nothing
#   --verify   after a clean merge, run cargo check and the desktop typecheck
#   --branch   branch to merge into (default: main)
#
# Exit codes: 0 up to date or merged cleanly, 1 conflicts predicted (--check),
#             2 merge stopped on conflicts, 3 precondition failed, 4 verification failed.
#
# We merge rather than rebase: main is pushed and shared, and merge commits keep a
# record of which upstream version each release was built on.
set -euo pipefail

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
UPSTREAM_URL="https://github.com/aaif-goose/goose.git"
TARGET_BRANCH="main"
CHECK_ONLY=false
VERIFY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) CHECK_ONLY=true ;;
    --verify) VERIFY=true ;;
    --branch) TARGET_BRANCH="$2"; shift ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 3 ;;
  esac
  shift
done

if [[ -t 1 ]]; then
  RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; BOLD=$'\e[1m'; RESET=$'\e[0m'
else
  RED=""; GREEN=""; YELLOW=""; BOLD=""; RESET=""
fi

fail() { echo "${RED}error:${RESET} $*" >&2; exit 3; }

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
MODIFIED_LIST="distro/MODIFIED_UPSTREAM_FILES.txt"
UPSTREAM_REF="$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"

if ! git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1; then
  echo "Adding remote '$UPSTREAM_REMOTE' -> $UPSTREAM_URL"
  git remote add "$UPSTREAM_REMOTE" "$UPSTREAM_URL"
fi

[[ -e "$(git rev-parse --git-path MERGE_HEAD)" ]] && fail "a merge is already in progress; finish it or run 'git merge --abort'."
[[ "$(git branch --show-current)" == "$TARGET_BRANCH" ]] || fail "check out '$TARGET_BRANCH' first (currently on '$(git branch --show-current)')."
if ! git diff --quiet || ! git diff --cached --quiet; then
  fail "working tree has uncommitted changes; commit or stash them first."
fi

echo "Fetching $UPSTREAM_REF ..."
git fetch --quiet "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"

behind=$(git rev-list --count "HEAD..$UPSTREAM_REF")
ahead=$(git rev-list --count "$UPSTREAM_REF..HEAD")
base=$(git merge-base HEAD "$UPSTREAM_REF")

echo
echo "${BOLD}Upstream sync report${RESET}"
echo "  branch:           $TARGET_BRANCH ($(git rev-parse --short HEAD))"
echo "  upstream:         $UPSTREAM_REF ($(git rev-parse --short "$UPSTREAM_REF"), $(git describe --tags --always "$UPSTREAM_REF"))"
echo "  current base:     $(git rev-parse --short "$base") ($(git log -1 --format=%cs "$base"))"
echo "  our commits:      $ahead"
echo "  incoming commits: $behind"

if [[ "$behind" -eq 0 ]]; then
  echo
  echo "${GREEN}Already up to date with upstream.${RESET}"
  exit 0
fi

tracked_customizations() {
  [[ -f "$MODIFIED_LIST" ]] && grep -v -e '^[[:space:]]*#' -e '^[[:space:]]*$' "$MODIFIED_LIST" || true
}

report_conflicts() {
  local file customized
  customized="$(tracked_customizations)"
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    if grep -qxF "$file" <<<"$customized"; then
      echo "  ${RED}CONFLICT${RESET} $file ${YELLOW}(Kidzink customization, see DISTRO_NOTES.md)${RESET}"
    else
      echo "  ${RED}CONFLICT${RESET} $file"
    fi
  done
}

echo
echo "Incoming upstream changes to files we customize:"
touched=0
while IFS= read -r file; do
  if [[ -n "$(git diff --name-only "$base" "$UPSTREAM_REF" -- "$file")" ]]; then
    echo "  $file"
    touched=$((touched + 1))
  fi
done < <(tracked_customizations)
[[ $touched -eq 0 ]] && echo "  (none)"

predicted=""
if ! merge_tree_output=$(git merge-tree --write-tree --name-only --no-messages HEAD "$UPSTREAM_REF"); then
  predicted="$(tail -n +2 <<<"$merge_tree_output")"
fi

echo
if [[ -z "$predicted" ]]; then
  echo "${GREEN}No conflicts predicted.${RESET}"
else
  echo "${YELLOW}Predicted conflicts:${RESET}"
  report_conflicts <<<"$predicted"
fi

if $CHECK_ONLY; then
  echo
  echo "Preview only (--check); nothing was changed."
  [[ -z "$predicted" ]] && exit 0 || exit 1
fi

backup="backup/pre-sync-$(date +%Y%m%d-%H%M%S)"
git branch "$backup" HEAD
echo
echo "Saved current state as branch '$backup'."

upstream_desc="$(git describe --tags --always "$UPSTREAM_REF")"
if ! git merge --no-ff --no-edit -m "Merge upstream goose $upstream_desc into $TARGET_BRANCH" "$UPSTREAM_REF" >/dev/null 2>&1; then
  echo
  echo "${RED}Merge stopped with conflicts:${RESET}"
  report_conflicts < <(git diff --name-only --diff-filter=U)
  cat <<EOF

Next steps:
  1. Resolve each file (keep upstream's change and re-apply our customization;
     DISTRO_NOTES.md explains what each customization does).
  2. git add <files> && git commit
  3. Re-run this script with --verify, or build and test by hand.
To give up: git merge --abort   (branch '$backup' holds the pre-sync state)
EOF
  exit 2
fi

echo "${GREEN}Merged $behind upstream commits cleanly${RESET} ($upstream_desc)."

missing=0
while IFS= read -r file; do
  if [[ ! -e "$file" ]]; then
    [[ $missing -eq 0 ]] && echo && echo "${YELLOW}Customized files no longer present (upstream moved or deleted them):${RESET}"
    echo "  $file"
    missing=$((missing + 1))
  fi
done < <(tracked_customizations)
[[ $missing -gt 0 ]] && echo "Find where each customization belongs now and update $MODIFIED_LIST."

if $VERIFY; then
  echo
  echo "Verifying build ..."
  [[ -f bin/activate-hermit ]] && source bin/activate-hermit >/dev/null 2>&1
  if ! cargo check -p goose-cli; then
    echo "${RED}cargo check failed.${RESET} Fix, commit, or reset to '$backup'." >&2
    exit 4
  fi
  if ! (cd ui/desktop && pnpm install --frozen-lockfile && pnpm run typecheck); then
    echo "${RED}Desktop typecheck failed.${RESET} Fix, commit, or reset to '$backup'." >&2
    exit 4
  fi
  echo "${GREEN}Verification passed.${RESET}"
fi

echo
echo "Review the merge, run a full build, then push: git push origin $TARGET_BRANCH"
echo "Delete the backup when satisfied: git branch -D $backup"
