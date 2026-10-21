#!/usr/bin/env bash
# รันเทสทั้งหมด: bash tests/run.sh   (ต้องมี node + playwright ติดตั้งแบบ global)
#   JOBS=3 bash tests/run.sh     รันหน้าเว็บพร้อมกัน 3 ตัว (เร็วขึ้น · ทุกเทสใช้พอร์ตไม่ซ้ำกัน)
#   bash tests/run.sh prod v281  รันเฉพาะบางตัว
# สรุปท้ายสุดว่าตัวไหนพัง (exit ไม่เป็น 0, มีบรรทัด FAIL หรือ Timeout) · ถ้ามีตัวพังจะออกด้วย exit 1
cd "$(dirname "$0")"
export PW="${PW:-$(npm root -g)/playwright/index.mjs}"
JOBS="${JOBS:-1}"
LOG="$(mktemp -d)"; export LOG
GS="dup v116 deluser helpers v120 v121 v125 v126 v129 v1321 v133 v134 v135 v136 v137 v138 v139 v141 v144 v145 v146 v147 swpush swpush2"
UI="demo timer e2e sugg dupui cam admin gantt grange ghover due chat note helpers v224 newx fast prod hovercl salehov prodadd chatimg inkboth qc mobile rtc stock cadcam tabs urgent joblink v262 v271 v272 v273 v275 v2751 v2752 v276 v2761 v277 v2771 v278 v279 v280 v281 v282 v283 v284 v285 v287 v2891 v291 v295 v296 v2962 v297 v298 v2100 v21003 v2101 v21011"
if [ $# -gt 0 ]; then GS=""; UI="$*"; fi

check() {   # $1 = ชื่อ, $2 = exit code, $3 = ไฟล์ log
  if [ "$2" != "0" ] || grep -qE '^FAIL|TimeoutError|[1-9][0-9]* failed|[1-9][0-9]* fail$' "$3"; then echo "$1" >> "$LOG/failed"; echo "✗ $1"; else echo "✓ $1"; fi
}
export -f check

start=$(date +%s)
if [ -n "$GS" ]; then
  echo "== หลังบ้าน (จำลอง Apps Script)"
  for t in $GS; do
    if [ "$t" = dup ]; then node gs/dup.js ../backend/Code.gs > "$LOG/gs-$t.log" 2>&1; else node "gs/$t.js" > "$LOG/gs-$t.log" 2>&1; fi
    check "gs/$t" $? "$LOG/gs-$t.log"
  done
  # โปรแกรมช่วยคีย์ Express (PowerShell) — ข้ามถ้าเครื่องนี้ไม่มี pwsh
  PWSH="${PWSH:-$(command -v pwsh || ls /opt/pwsh/pwsh 2>/dev/null)}"
  if [ -n "$PWSH" ]; then PWSH="$PWSH" bash ps/v288.sh > "$LOG/ps-v288.log" 2>&1; check "ps/v288" $? "$LOG/ps-v288.log"; else echo "- ps/v288 (ไม่มี pwsh ข้าม)"; fi
fi
echo "== หน้าเว็บ (Playwright) · พร้อมกัน $JOBS ตัว"
run_ui() { t="$1"; s=$(date +%s); timeout 240 node "$t.mjs" > "$LOG/$t.log" 2>&1; c=$?; r=$(check "$t" $c "$LOG/$t.log"); echo "$r ($(( $(date +%s) - s ))s)"; }
export -f run_ui
printf '%s\n' $UI | xargs -P "$JOBS" -I{} bash -c 'run_ui {}'

echo
echo "เวลาทั้งหมด $(( $(date +%s) - start )) วินาที"
if [ -s "$LOG/failed" ]; then
  echo "พัง $(sort -u "$LOG/failed" | wc -l) ตัว:"
  sort -u "$LOG/failed" | while read -r f; do n="${f#gs/}"; [ "$n" != "$f" ] && n="gs-$n"; echo "---- $f"; grep -E '^FAIL|Error|failed|fail$' "$LOG/$n.log" | head -8; done
  echo "log เต็มอยู่ที่ $LOG"; exit 1
fi
echo "ผ่านทั้งหมด ✓"; rm -rf "$LOG"
