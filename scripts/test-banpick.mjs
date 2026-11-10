// Tes skor + urutan Ban & Pick gabungan (js/banpick.js) dan cek data/banpick-merged.js. Pakai: node scripts/test-banpick.mjs
import fs from "fs";
import vm from "vm";
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync("js/banpick.js", "utf8"), ctx);
const B = ctx.window.__banpick, nm = (s) => s;
let fail = 0;
const check = (label, got, want) => { const ok = got === want; if (!ok) fail++; console.log(`${ok ? "OK  " : "GAGAL"} ${label}: ${got} (harus ${want})`); };
// A counter B dan C; B counter A. Partner A-D (dicatat dua sumber, tetap sekali), C-D (cuma di daftar D), B-C.
// Trio A+C+D.
const D = {
  heroes: {
    A: { counters: { B: ["cn"], C: ["cn", "hs"] }, partners: { D: ["cn", "hs"] } },
    B: { counters: { A: ["hs"] }, partners: { C: ["camp"] } },
    C: { counters: {}, partners: { B: ["camp"] } },
    D: { counters: {}, partners: { A: ["cn", "hs"], C: ["hs"] } },
    E: { counters: {}, partners: {} },
  },
  trios: [{ h: ["A", "C", "D"], src: ["camp"] }],
};
const H = D.heroes;
check("counterHit A->B", B.counterHit(H, "A", "B"), true);
check("counterHit C->A tidak ada", B.counterHit(H, "C", "A"), false);
check("partnerHit C-D dari daftar D saja (simetris)", B.partnerHit(H, "C", "D"), true);
check("partnerHit A-C tidak ada", B.partnerHit(H, "A", "C"), false);
check("pick A vs musuh {B,C,E}: +1 B -1 B +1 C", B.pickScore(D, "A", [], ["B", "C", "E"], nm).total, 1);
check("pick A, tim {D}: partner dua sumber dihitung sekali", B.pickScore(D, "A", ["D"], [], nm).total, 1);
check("pick A, tim {C,D}: partner D + trio lengkap", B.pickScore(D, "A", ["C", "D"], [], nm).total, 2);
check("pick A, tim {C}: trio belum lengkap tidak dihitung", B.pickScore(D, "A", ["C"], [], nm).total, 0);
check("ban A, tim kita {B,C}: counter B + counter C", B.banScore(D, "A", ["B", "C"], [], nm).total, 2);
check("ban D, musuh {A,C}: partner A + partner C + trio", B.banScore(D, "D", [], ["A", "C"], nm).total, 3);
check("ban B, tim kita {A}, musuh {C}: counter A + partner C", B.banScore(D, "B", ["A"], ["C"], nm).total, 2);
check("alasan tanpa angka", B.pickScore(D, "A", ["C", "D"], ["B"], nm).parts.every((p) => !/[0-9]/.test(p.t)), true);
check("getPickCount default 0", B.getPickCount("A"), 0);
ctx.window.getHeroPickCount = (s) => ({ A: 3 })[s];
check("getPickCount dari window.getHeroPickCount", B.getPickCount("A") + "," + B.getPickCount("B"), "3,0");
delete ctx.window.getHeroPickCount;
const rows = () => [{ k: "x", s: { total: 1 } }, { k: "y", s: { total: 1 } }, { k: "z", s: { total: 2 } }, { k: "w", s: { total: 1 } }];
const RH = { x: { wr: 50, tier: "B" }, y: { wr: 52, tier: "B" }, z: { wr: 1, tier: "C" }, w: { wr: 70, tier: null } };
check("urutan: skor, tier, wr, tanpa tier belakang", B.rank(rows(), RH, "wr", nm).map((r) => r.k).join(","), "z,y,x,w");
check("pickCount: yang jarang di-pick duluan sebelum tier", B.rank(rows(), RH, "wr", nm, (s) => ({ y: 5, x: 1 })[s] || 0).map((r) => r.k).join(","), "z,w,x,y");
check("pickCount tidak mengalahkan skor", B.rank(rows(), RH, "wr", nm, (s) => (s === "z" ? 99 : 0))[0].k, "z");
check("seri total: nama", B.rank([{ k: "b", s: { total: 1 } }, { k: "a", s: { total: 1 } }], { a: {}, b: {} }, "wr", nm).map((r) => r.k).join(","), "a,b");
check("tierRank S+ < S < D < tanpa tier", [B.tierRank("S+"), B.tierRank("S"), B.tierRank("D"), B.tierRank(null)].join(","), "0,1,5,6");

// Data gabungan nyata.
const w = {}; new Function("window", fs.readFileSync("data/banpick-merged.js", "utf8"))(w);
const M = w.BANPICK_DATA, MH = M.heroes, slugs = Object.keys(MH);
check("semua hero bisa dipilih", M.selectable.length, slugs.length);
check("referensi counter/partner/trio dikenal", slugs.every((k) => Object.keys(MH[k].counters).concat(Object.keys(MH[k].partners)).every((s) => MH[s])) && M.trios.every((t) => t.h.every((s) => MH[s])), true);
check("partner simetris", slugs.every((k) => Object.keys(MH[k].partners).every((s) => MH[s].partners[k])), true);
check("tidak ada slug alias tersisa (zhu-bajie, annette, shieldun)", ["zhu-bajie", "annette", "shieldun"].some((s) => MH[s]), false);
check("hero cuma hokstats tetap ada (lorion)", !!MH.lorion, true);
check("hero cuma CN tetap ada (ma-chao)", !!MH["ma-chao"], true);
const pc = slugs.reduce((n, k) => n + Object.keys(MH[k].counters).length, 0);
check("jumlah counter = meta", pc, M.meta.counter.total);
process.exit(fail ? 1 : 0);
