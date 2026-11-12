#!/usr/bin/env bash
# Exit 1 and list lines if any file contains an em dash or en dash. Usage: ./dashcheck.sh <file or dir>...
if grep -rnP '[\x{2013}\x{2014}]' "$@" --include='*.md' --include='*.txt' --include='*.json' --include='*.html' --include='*.csv' 2>/dev/null; then exit 1; fi
echo "dash check: clean"
