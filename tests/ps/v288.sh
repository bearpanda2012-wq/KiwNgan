#!/usr/bin/env bash
# โปรแกรมช่วยคีย์ Express: ตรวจซ้ำกับไฟล์ Express (โหมด -CheckOnly · ข้อมูลจำลอง)
set -e; cd "$(dirname "$0")"; T=$(mktemp -d); PW=${PWSH:-/opt/pwsh/pwsh}
python3 mkdbf.py "$T"
printf '{"expressRoot":"%s","prefix":"ROY"}' "$T" > "$T/config.json"
cat > "$T/job.json" <<'J'
{"v":1,"by":"test","docs":[{"dep":"JS01","rem":"Job R69-1","lines":[{"id":"a","cod":"RM-A-01","loc":"RM","qty":4},{"id":"b","cod":"RM-B-02","loc":"RM","qty":3},{"id":"c","cod":"NOPE-1","loc":"RM","qty":1},{"id":"d","cod":"RM-A-01","loc":"RM","qty":7}]},{"dep":"XX9","rem":"","lines":[{"id":"e","cod":"CU-C-03","loc":"CU","qty":1}]},{"dep":"C21","rem":"x","lines":[{"id":"f","cod":"CU-C-03","loc":"CU","qty":2},{"id":"g","cod":"RM-A-01; DEL","loc":"RM","qty":1}]}]}
J
out=$("$PW" -NoProfile -File ../../express-sync/KiwNganExpressKey.ps1 -File "$T/job.json" -CheckOnly -ConfigPath "$T/config.json")
echo "$out"
ok=0; bad=0; chk() { if echo "$out" | grep -qE "$2"; then ok=$((ok+1)); echo "ok   $1"; else bad=$((bad+1)); echo "FAIL $1"; fi; }
chk 'enough stock passes' '^OK  ใบ1 RM-A-01 RM x4 '
chk 'short stock blocked' '^BAD ใบ1 RM-B-02 .*ไม่พอ: มี 2 ต้องการ 3'
chk 'unknown code blocked' '^BAD ใบ1 NOPE-1 .*ไม่มีรหัสนี้ใน Express'
chk 'cumulative need counted' '^BAD ใบ1 RM-A-01 RM x7 .*ไม่พอ: มี 10 ต้องการ 11'
chk 'unknown dept blocked' '^BAD ใบ2 CU-C-03 .*ไม่มีรหัสแผนก XX9'
chk 'valid dept passes' '^OK  ใบ3 CU-C-03 CU x2'
chk 'odd code rejected' '^BAD ใบ3 RM-A-01; DEL .*รูปแบบไม่ถูกต้อง'
U='kiwngan-express:eyJ2IjogMSwgImJ5IjogInQiLCAiZG9jcyI6IFt7ImRlcCI6ICJDMjEiLCAicmVtIjogIkpvYiDguJfguJTguKrguK3guJoiLCAibGluZXMiOiBbeyJpZCI6ICJhIiwgImNvZCI6ICJSTS1BLTAxIiwgImxvYyI6ICJSTSIsICJxdHkiOiAyLjV9XX1dfQ/'
out=$("$PW" -NoProfile -File ../../express-sync/KiwNganExpressKey.ps1 -Url "$U" -CheckOnly -ConfigPath "$T/config.json"); echo "$out"
chk 'link (base64url, trailing slash) decoded' '^OK  ใบ1 RM-A-01 RM x2.5 มี 10'
out=$("$PW" -NoProfile -File ../../express-sync/KiwNganExpressKey.ps1 -Url 'kiwngan-express:@@bad' -CheckOnly -ConfigPath "$T/config.json" || true)
chk 'broken link refused' 'อ่านรายการจากแอปไม่ได้'
rm -rf "$T"; echo "$ok ok, $bad failed"; [ $bad -eq 0 ]
