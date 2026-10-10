#!/usr/bin/env bash
# รันเทสทั้งหมด: bash tests/run.sh   (ต้องมี node + playwright ติดตั้งแบบ global)
set -e
cd "$(dirname "$0")"
export PW="${PW:-$(npm root -g)/playwright/index.mjs}"
echo "== backend (mock Apps Script)"; node gs/dup.js ../backend/Code.gs; node gs/v116.js; node gs/deluser.js; node gs/helpers.js; node gs/v120.js; node gs/v121.js; node gs/v125.js; node gs/v126.js; node gs/v129.js
for t in demo timer e2e sugg dupui cam admin gantt grange ghover due chat note helpers v224 newx fast prod hovercl salehov prodadd chatimg inkboth qc mobile rtc stock; do echo "== $t"; timeout 200 node $t.mjs; done
