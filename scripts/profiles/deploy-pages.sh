#!/usr/bin/env bash
# Coach/client fork (PROJECT.md): builds the GitHub Pages version of the app and publishes it to
# the gh-pages branch, which GitHub serves at https://<owner>.github.io/<repo>/.
#
#   scripts/profiles/deploy-pages.sh                 # needs: node, npm ci done in frontend/
#   GITHUB_DATA=owner/repo@branch scripts/profiles/deploy-pages.sh   # another repo for the data
#
# The site reads and writes the client files in data/ on the main branch (VITE_GITHUB_DATA), so
# publishing never touches the data. The build sits in .site/, a worktree of gh-pages: only what
# changed is pushed (the exercise media are the same files main already has).
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
REPO="${GITHUB_DATA:-Bigchaka02/opengym}"
SITE="$ROOT/.site"

if [ ! -e "$SITE/.git" ]; then
  if git fetch -q origin gh-pages 2>/dev/null; then
    git worktree add -q -B gh-pages "$SITE" FETCH_HEAD
  else
    git worktree add -q --orphan -b gh-pages "$SITE"
  fi
fi
find "$SITE" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
(cd frontend && VITE_GITHUB_DATA="$REPO" npx vite build --outDir "$SITE")
node scripts/catalogue/stage-media.mjs "$SITE"
touch "$SITE/.nojekyll"   # plain static files: no Jekyll pass, which would drop _-prefixed ones
git -C "$SITE" add -A
if git -C "$SITE" diff --cached --quiet; then echo "Site unchanged."; else git -C "$SITE" commit -qm "${PUBLISH_MSG:-Publish site}"; fi
git -C "$SITE" push -q origin gh-pages
echo "Published: https://$(echo "${REPO%%/*}" | tr '[:upper:]' '[:lower:]').github.io/$(echo "${REPO#*/}" | cut -d@ -f1)/"
