#!/usr/bin/env bash
# The Shelfmark — dev server
# APP_PORT is provided by the environment; falls back to 5173.
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then npm install; fi
npm run dev