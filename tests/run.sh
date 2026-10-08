#!/usr/bin/env bash
# รันเทสทั้งหมด: bash tests/run.sh   (ต้องมี node + playwright ติดตั้งแบบ global)
set -e
cd "$(dirname "$0")"
export PW="${PW:-$(npm root -g)/playwright/index.mjs}"
echo "== backend (mock Apps Script)"; node gs/dup.js ../backend/Code.gs; node gs/v116.js; node gs/deluser.js
for t in demo timer e2e sugg dupui cam admin gantt grange ghover due chat fast rtc; do echo "== $t"; timeout 200 node $t.mjs; done
