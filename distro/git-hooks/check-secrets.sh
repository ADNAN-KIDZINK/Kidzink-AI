#!/usr/bin/env bash
# Blocks commits that add API keys, tokens or private keys.
#   distro/git-hooks/check-secrets.sh          scan staged changes (what pre-commit runs)
#   distro/git-hooks/check-secrets.sh --all    scan every tracked file
# Uses gitleaks when it's installed; otherwise falls back to the patterns below.
set -euo pipefail

mode="${1:-staged}"

if command -v gitleaks >/dev/null 2>&1; then
  if [ "$mode" = "--all" ]; then
    exec gitleaks dir --no-banner --redact .
  fi
  exec gitleaks git --staged --no-banner --redact .
fi

# OpenRouter, Anthropic, OpenAI, GitHub, AWS, Slack, Google, Stripe keys, private keys,
# and Supabase service-role/secret keys. Test fixtures such as "sk-or-v1-good" are too short to match.
patterns=(
  'sk-or-v1-[0-9a-f]{40,}'
  'sk-ant-[A-Za-z0-9_-]{30,}'
  'sk-(proj-)?[A-Za-z0-9_-]{40,}'
  'gh[pousr]_[A-Za-z0-9]{36}'
  'github_pat_[A-Za-z0-9_]{60,}'
  'AKIA[0-9A-Z]{16}'
  'xox[abpors]-[A-Za-z0-9-]{20,}'
  'AIza[0-9A-Za-z_-]{35}'
  '(sk|rk)_live_[0-9A-Za-z]{20,}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'sb_secret_[A-Za-z0-9_-]{20,}'
  'service_role[^\n]{0,40}eyJ[A-Za-z0-9_-]{20,}'
)
pattern="$(IFS='|'; echo "${patterns[*]}")"

# Files that only ever hold secrets.
secret_files='(^|/)(\.env(\.[^/]*)?|[^/]*\.(pem|p12|pfx|key|keystore|jks)|credentials\.json|service-account[^/]*\.json)$'
allowed_files='(^|/)\.env\.(example|sample|template)$|^ui/desktop/\.env$'

hook_dir="$(cd "$(dirname "$0")" && pwd)"
exclusions=(':!distro/git-hooks/check-secrets.sh')
while IFS= read -r allowed; do
  case "$allowed" in '' | '#'*) continue ;; esac
  exclusions+=(":!$allowed")
done <"$hook_dir/secret-scan-allowlist.txt"

found=0

if [ "$mode" = "--all" ]; then
  files="$(git ls-files)"
  matches="$(git grep -nIE "$pattern" -- . "${exclusions[@]}" || true)"
else
  files="$(git diff --cached --name-only --diff-filter=ACMR)"
  matches="$(git diff --cached -U0 --diff-filter=ACMR -- . "${exclusions[@]}" \
    | grep -E '^\+[^+]' | grep -E "$pattern" || true)"
fi

blocked_files="$(printf '%s\n' "$files" | grep -E "$secret_files" | grep -vE "$allowed_files" || true)"

if [ -n "$blocked_files" ]; then
  echo "Secret scan: these files usually hold secrets and must not be committed:" >&2
  printf '  %s\n' $blocked_files >&2
  found=1
fi

if [ -n "$matches" ]; then
  echo "Secret scan: this looks like an API key, token or private key:" >&2
  # Show where, not the secret itself.
  printf '%s\n' "$matches" | sed -E "s/($pattern)/<redacted>/g" | cut -c1-160 | sed 's/^/  /' >&2
  found=1
fi

if [ "$found" -ne 0 ]; then
  echo "Remove it (keys belong in the OS keychain, GitHub secrets or Supabase secrets)." >&2
  echo "If it's an upstream test fixture, add the file to distro/git-hooks/secret-scan-allowlist.txt." >&2
  exit 1
fi
