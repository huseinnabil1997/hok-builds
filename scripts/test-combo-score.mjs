// Tes aturan skor duo/trio (aturan 2) untuk js/banpick-camp.js dan js/banpick.js. Pakai: node scripts/test-combo-score.mjs
// Bobot trio sebagian: w = duo(K,M) / (duo(K,M)+duo(K,Z)+duo(M,Z)); jumlah 0 -> w = 0,5.
import fs from "fs";
import vm from "vm";
let fail = 0;
const trioBC = [{ v: 2, others: ["B", "C"] }];
for (const file of ["js/banpick-camp.js", "js/banpick.js"]) {
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(file, "utf8"), ctx);
  const score = ctx.window.__comboScore;
  const same = (a, b) => a === b, nm = (s) => s;
  const run = (duos, team, trios, sfx) => {
    const duo = (a, b) => duos[[a, b].sort().join("+")] || 0;
    return score("A", team, duo, trios || trioBC, same, nm, sfx || "");
  };
  const cases = [
    {
      duos: { "A+B": 1, "A+C": 1, "B+C": 2 }, team: ["B"], trios: [{ v: 8, others: ["B", "C"] }],
      want: 2, part: "Bagian dari trio A-B-C (x0,25)",
      label: "w=1/(1+1+2)=0,25, trio=8, tim {B} -> 2, mengalahkan duo 1",
    },
    {
      duos: {}, team: ["B"], trios: [{ v: 4, others: ["B", "C"] }],
      want: 2, part: "Bagian dari trio A-B-C (x0,5)",
      label: "semua duo 0, trio=4, tim {B} -> fallback w=0,5",
    },
    {
      duos: { "A+C": 1 }, team: ["B"],
      want: 0, parts: 0,
      label: "duo A-C=1, duo A-B=0, trio=2, tim {B} -> w=0, tidak dihitung",
    },
    {
      duos: { "A+B": 5, "A+C": 1, "B+C": 1 }, team: ["B"], trios: [{ v: 4, others: ["B", "C"] }],
      want: 5, part: "Duo dengan B",
      label: "duo A-B=5 lebih besar dari trio x w, tim {B} -> duo",
    },
    {
      duos: { "A+B": 2, "A+C": 2 }, team: ["B"], trios: [{ v: 4, others: ["B", "C"] }],
      want: 2, part: "Duo dengan B",
      label: "duo A-B=2 seri dengan trio x 0,5 -> duo asli",
    },
    {
      duos: { "A+B": 1, "A+C": 1 }, team: ["B", "C"],
      want: 2, part: "Trio dengan B dan C",
      label: "tim {B,C} -> trio penuh, pasangan tidak dihitung lagi",
    },
    {
      duos: { "A+C": 1 }, team: ["C"],
      want: 2, part: "Bagian dari trio A-C-B (x1)",
      label: "tim {C}, w=1 -> trio utuh mengalahkan duo 1",
    },
    {
      duos: { "A+B": 1, "A+C": 1 }, team: ["B"],
      trios: [{ v: 10, others: ["B", "C"] }, { v: 6, others: ["B", "D"] }],
      want: 6, part: "Bagian dari trio A-B-D (x1) (musuh)",
      sfx: " (musuh)",
      label: "dua trio, yang terbesar menang; sufiks tetap di ujung",
    },
  ];
  for (const c of cases) {
    const got = run(c.duos, c.team, c.trios, c.sfx);
    const okTotal = Math.abs(got.total - c.want) < 1e-9;
    const okPart = c.part ? got.parts.some((p) => p.t === c.part) : true;
    const okCount = c.parts == null || got.parts.length === c.parts;
    const ok = okTotal && okPart && okCount;
    if (!ok) fail++;
    const detail = got.parts.map((p) => p.t + "=" + p.v).join("; ") || "(kosong)";
    console.log(`${ok ? "OK  " : "GAGAL"} ${file} | ${c.label}: ${got.total} (harus ${c.want}) | ${detail}`);
  }
  // Total poin tim (teamCombo): trio lengkap sekali + menutup 3 pasangannya, sisa pasangan pakai duo asli.
  const teamCombo = ctx.window.__teamCombo;
  const tcases = [
    { duos: { "A+B": 1, "A+C": 2, "B+C": 3, "C+D": 4 }, team: ["A", "B", "C", "D"], trios: [{ h: ["A", "B", "C"], v: 5 }], want: 9, label: "trio A-B-C=5 menutup A-B, A-C, B-C; sisa duo C-D=4" },
    { duos: { "A+B": 1.5 }, team: ["A", "B"], trios: [{ h: ["A", "B", "C"], v: 5 }], want: 1.5, label: "trio belum lengkap (C tidak di tim) -> cuma duo A-B" },
    { duos: {}, team: ["A", "B", "C"], trios: [{ h: ["A", "B", "C"], v: 5 }, { h: ["B", "C", "A"], v: 6 }], want: 6, label: "trio sama dari dua daftar -> sekali, nilai terbesar" },
    { duos: { "A+B": 2 }, team: [], trios: [], want: 0, label: "tim kosong -> 0" },
  ];
  for (const c of tcases) {
    const duo = (a, b) => c.duos[[a, b].sort().join("+")] || 0;
    const triosOf = (k) => c.trios.filter((t) => t.h.includes(k)).map((t) => ({ v: t.v, others: t.h.filter((x) => x !== k) }));
    const got = teamCombo(c.team, duo, triosOf, (a, b) => a === b, (x) => x);
    const ok = Math.abs(got.total - c.want) < 1e-9;
    if (!ok) fail++;
    console.log(`${ok ? "OK  " : "GAGAL"} ${file} | tim: ${c.label}: ${got.total} (harus ${c.want}) | ${got.parts.map((p) => p.t + "=" + p.v).join("; ") || "(kosong)"}`);
  }
}
process.exit(fail ? 1 : 0);
