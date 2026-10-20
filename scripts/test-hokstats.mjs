// Tes skor Ban & Pick hokstats (js/banpick-hokstats.js). Pakai: node scripts/test-hokstats.mjs
import fs from "fs";
import vm from "vm";
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync("js/banpick-hokstats.js", "utf8"), ctx);
const S = ctx.window.__hokstats, nm = (s) => s;
// A strong vs B; C countered by A (relasi dari sisi C); B strong vs A; D tidak punya relasi.
const H = { A: { strong: ["B"], weak: [] }, B: { strong: ["A"], weak: [] }, C: { strong: [], weak: ["A"] }, D: { strong: [], weak: [] } };
let fail = 0;
const check = (label, got, want) => { const ok = got === want; if (!ok) fail++; console.log(`${ok ? "OK  " : "GAGAL"} ${label}: ${got} (harus ${want})`); };
check("counterHit A->B dari Strong against A", S.counterHit(H, "A", "B"), true);
check("counterHit A->C dari Countered by C", S.counterHit(H, "A", "C"), true);
check("counterHit C->A tidak ada", S.counterHit(H, "C", "A"), false);
check("pick A vs musuh {B,C,D}: +1 B +1 C -1 B", S.pickScore(H, "A", [], ["B", "C", "D"], nm).total, 1);
check("ban A vs tim kita {B,C}: 2", S.banScore(H, "A", ["B", "C"], nm).total, 2);
check("total tim {A,D} vs {B,C}: A->B, A->C", S.teamScore(H, ["A", "D"], ["B", "C"], nm).total, 2);
check("total tim {B,C} vs {A,D}: B->A", S.teamScore(H, ["B", "C"], ["A", "D"], nm).total, 1);
check("total tim kosong", S.teamScore(H, [], ["A"], nm).total, 0);
const rows = [{ k: "x", s: { total: 1 } }, { k: "y", s: { total: 1 } }, { k: "z", s: { total: 2 } }];
check("urutan skor lalu wr", S.rank(rows, { x: { wr: 50 }, y: { wr: 52 }, z: { wr: 40 } }, "wr", nm).map((r) => r.k).join(","), "z,y,x");
process.exit(fail ? 1 : 0);
