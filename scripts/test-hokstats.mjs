// Tes skor Ban & Pick hokstats (js/banpick-hokstats.js). Pakai: node scripts/test-hokstats.mjs
import fs from "fs";
import vm from "vm";
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync("js/banpick-hokstats.js", "utf8"), ctx);
const S = ctx.window.__hokstats, nm = (s) => s;
// A strong vs B; C countered by A (relasi dari sisi C); B strong vs A; D tidak punya counter.
// Partner: A-D (dari daftar A), C-D (dari daftar D dan C, tetap sekali), B-C (dari daftar C).
const H = { A: { strong: ["B"], weak: [], partners: ["D"] }, B: { strong: ["A"], weak: [], partners: [] }, C: { strong: [], weak: ["A"], partners: ["D", "B"] }, D: { strong: [], weak: [], partners: ["C"] } };
let fail = 0;
const check = (label, got, want) => { const ok = got === want; if (!ok) fail++; console.log(`${ok ? "OK  " : "GAGAL"} ${label}: ${got} (harus ${want})`); };
check("counterHit A->B dari Strong against A", S.counterHit(H, "A", "B"), true);
check("counterHit A->C dari Countered by C", S.counterHit(H, "A", "C"), true);
check("counterHit C->A tidak ada", S.counterHit(H, "C", "A"), false);
check("partnerHit D-A dari daftar A", S.partnerHit(H, "D", "A"), true);
check("partnerHit A-C tidak ada", S.partnerHit(H, "A", "C"), false);
check("pick A vs musuh {B,C,D}: +1 B +1 C -1 B", S.pickScore(H, "A", [], ["B", "C", "D"], nm).total, 1);
check("pick A, tim kita {D}, musuh {B}: +1 B -1 B +1 partner D", S.pickScore(H, "A", ["D"], ["B"], nm).total, 1);
check("pick C, tim kita {D,B}: partner D + partner B", S.pickScore(H, "C", ["D", "B"], [], nm).total, 2);
check("ban A vs tim kita {B,C}: 2", S.banScore(H, "A", ["B", "C"], [], nm).total, 2);
check("ban A, tim kita {B}, musuh {D}: counter B + partner D", S.banScore(H, "A", ["B"], ["D"], nm).total, 2);
check("total tim {A,D} vs {B,C}: A->B, A->C, partner A-D", S.teamScore(H, ["A", "D"], ["B", "C"], nm).total, 3);
check("total tim {B,C} vs {A,D}: B->A, partner B-C", S.teamScore(H, ["B", "C"], ["A", "D"], nm).total, 2);
check("total tim {C,D}: partner C-D dua arah dihitung sekali", S.teamScore(H, ["C", "D"], [], nm).total, 1);
check("total tim kosong", S.teamScore(H, [], ["A"], nm).total, 0);
const rows = [{ k: "x", s: { total: 1 } }, { k: "y", s: { total: 1 } }, { k: "z", s: { total: 2 } }];
check("urutan skor lalu wr (tier sama)", S.rank(rows, { x: { wr: 50, tier: "B" }, y: { wr: 52, tier: "B" }, z: { wr: 40, tier: "C" } }, "wr", nm).map((r) => r.k).join(","), "z,y,x");
const rows2 = [{ k: "c", s: { total: 1 } }, { k: "s", s: { total: 1 } }, { k: "n", s: { total: 1 } }, { k: "a", s: { total: 1 } }, { k: "top", s: { total: 2 } }];
check("seri: tier S > A > C > tanpa tier, walau WR lebih rendah; skor tetap nomor satu", S.rank(rows2, { c: { wr: 60, tier: "C" }, s: { wr: 40, tier: "S" }, n: { wr: 70, tier: null }, a: { wr: 45, tier: "A" }, top: { wr: 1, tier: "C" } }, "wr", nm).map((r) => r.k).join(","), "top,s,a,c,n");
check("tierRank S+ < S < D < tanpa tier", [S.tierRank("S+"), S.tierRank("S"), S.tierRank("D"), S.tierRank(null)].join(","), "0,1,5,6");
process.exit(fail ? 1 : 0);
