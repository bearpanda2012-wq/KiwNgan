# สร้างไฟล์ .DBF จำลอง (ไม่ใช่ข้อมูลจริง) สำหรับทดสอบโปรแกรมช่วยคีย์
import struct, sys, os
def dbf(path, fields, rows):
    n = len(fields); hl = 32 + 32 * n + 1; rl = 1 + sum(f[2] for f in fields)
    with open(path, 'wb') as f:
        f.write(struct.pack('<B3BIHH20x', 3, 126, 10, 14, len(rows), hl, rl))
        for name, t, ln, dec in fields:
            f.write(struct.pack('<11sc4xBB14x', name.encode(), t.encode(), ln, dec))
        f.write(b'\r')
        for r in rows:
            f.write(b' ')
            for (name, t, ln, dec), v in zip(fields, r):
                s = (f'{v:>{ln}.{dec}f}' if t == 'N' else str(v)).encode('cp874')[:ln]
                f.write(s.ljust(ln) if t != 'N' else s.rjust(ln))
        f.write(b'\x1a')
root = sys.argv[1]; d = os.path.join(root, 'ROY69'); os.makedirs(d, exist_ok=True)
dbf(os.path.join(d, 'STMAS.DBF'), [('STKCOD', 'C', 20, 0), ('STKDES', 'C', 50, 0)], [('RM-A-01', 'แผ่นทดสอบ A'), ('RM-B-02', 'เหล็กทดสอบ B'), ('CU-C-03', 'ของลูกค้า C')])
dbf(os.path.join(d, 'STLOC.DBF'), [('STKCOD', 'C', 20, 0), ('LOCCOD', 'C', 4, 0), ('LOCBAL', 'N', 12, 2)], [('RM-A-01', 'RM', 10), ('RM-B-02', 'RM', 2), ('CU-C-03', 'CU', 5)])
dbf(os.path.join(d, 'ISTAB.DBF'), [('TABTYP', 'C', 2, 0), ('TYPCOD', 'C', 6, 0)], [('50', 'JS01'), ('50', 'C21'), ('20', 'PCS')])
