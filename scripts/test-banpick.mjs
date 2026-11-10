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
// Tiebreak dari riwayat pick nyata (window.getHeroPickCount): skor sama -> paling jarang di-pick duluan.
ctx.window.getHeroPickCount = (s) => ({ y: 2, x: 2, w: 1 })[s] || 0;
check("getHeroPickCount dipakai default rank", B.rank(rows(), RH, "wr", nm).map((r) => r.k).join(","), "z,w,y,x");
delete ctx.window.getHeroPickCount;
check("canAdd: tim kita maks 5, ban tanpa batas", [B.canAdd({ ally: [1, 2, 3, 4] }, "ally"), B.canAdd({ ally: [1, 2, 3, 4, 5] }, "ally"), B.canAdd({ ban: [1, 2, 3, 4, 5, 6] }, "ban")].join(","), "true,false,true");

// Riwayat pick (js/pick-history.js) dengan client Supabase tiruan.
vm.runInContext(fs.readFileSync("js/pick-history.js", "utf8"), ctx);
const P = ctx.window.__pickHistory;
function mockClient(seed, opts = {}) {
  const db = { rows: seed.slice(), next: 100, deletes: [], inserts: [], baseline: opts.baseline };
  let release = null;
  const client = {
    from(t) {
      if (t === "hero_usage_baseline") {
        return { select() { return { range() {
          if (db.baseline === undefined) return Promise.resolve({ data: null, error: { message: "relation does not exist" } });
          return Promise.resolve({ data: db.baseline, error: null });
        } }; } };
      }
      return {
        select() { return { order() { return { range(a, b) { return Promise.resolve({ data: db.rows.slice(a, b + 1), error: null }); } }; } }; },
        insert(obj) {
          db.inserts.push(obj);
          return { select() { return { single() {
            const row = { id: db.next++, hero_slug: obj.hero_slug, source: obj.source, created_at: "t" };
            const done = () => { if (opts.failInsert) return { data: null, error: { message: "x" } }; db.rows.unshift(row); return { data: row, error: null }; };
            if (opts.slowInsert) return new Promise((r) => { release = () => r(done()); });
            return Promise.resolve(done());
          } }; } };
        },
        delete() { return { eq(_c, id) { db.deletes.push(id); db.rows = db.rows.filter((r) => r.id !== id); return Promise.resolve({ error: null }); } }; },
      };
    },
  };
  return { client, db, release: () => release && release() };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
{
  const m = mockClient([{ id: 1, hero_slug: "ma-chao" }, { id: 2, hero_slug: "ma-chao" }, { id: 3, hero_slug: "yao" }]);
  const h = P.create(m.client, {});
  check("sebelum load: record diabaikan (belum login)", await h.record("yao", "manual"), null);
  await h.load();
  check("load: hitungan per slug", JSON.stringify(h.counts()), JSON.stringify({ "ma-chao": 2, yao: 1 }));
  const id = await h.record("lam", "rekomendasi");
  check("record: insert dengan source rekomendasi", m.db.inserts.map((x) => x.hero_slug + ":" + x.source).join(), "lam:rekomendasi");
  check("record: count naik", h.count("lam") + "/" + h.total(), "1/4");
  check("record: slug yang sama di draft yang sama tidak dobel", await h.record("lam", "manual"), null);
  await h.undo("lam");
  check("undo: baris yang baru dibuat dihapus", m.db.deletes.join() + "|" + h.count("lam"), id + "|0");
  check("undo tanpa slot: tidak menghapus apa-apa", await h.undo("ma-chao"), false);
  await h.record("ma-chao", "manual"); h.newDraft(); await h.undo("ma-chao");
  check("reset draft: riwayat tetap, undo tidak menghapus", h.count("ma-chao"), 3);
  await h.removeOne("ma-chao");
  check("removeOne (-1): hapus satu baris terbaru", h.count("ma-chao") + "|" + m.db.deletes.length, "2|2");
  h.clear();
  check("logout: hitungan kosong", h.total() + "|" + h.enabled(), "0|false");
}
{
  const m = mockClient([], { slowInsert: true });
  const h = P.create(m.client, {}); await h.load();
  const p = h.record("lam", "rekomendasi"); const u = h.undo("lam");
  m.release(); await p; await u; await tick();
  check("undo sebelum insert selesai: baris tetap dihapus", m.db.rows.length + "|" + h.count("lam") + "|" + m.db.deletes.length, "0|0|1");
}
{
  const m = mockClient([]); let err = 0;
  const h = P.create(m.client, { onError: () => err++ }); await h.load();
  m.client.from = () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: "rls" } }) }) }) });
  check("insert gagal: null, onError, slot dilepas", (await h.record("lam", "manual")) + "|" + err + "|" + h.pending().length, "null|1|0");
}
{
  // Data awal HoK Camp + riwayat pick: dijumlahkan untuk "dipakai Nx" dan tiebreak.
  const m = mockClient([{ id: 1, hero_slug: "lam" }, { id: 2, hero_slug: "yao" }], {
    baseline: [{ hero_slug: "lam", matches: 3, updated_at: "2026-11-10T12:00:00Z" }, { hero_slug: "yao", matches: 1, updated_at: "2026-11-09T12:00:00Z" }, { hero_slug: "ma-chao", matches: 0 }],
  });
  let berr = 0;
  const h = P.create(m.client, { onBaselineError: () => berr++ }); await h.load();
  check("baseline + riwayat: used = match Camp + pick", [h.used("lam"), h.used("yao"), h.used("ma-chao"), h.used("x")].join(), "4,2,0,0");
  check("baseline tidak mengubah count riwayat", h.count("lam") + "|" + h.total(), "1|2");
  check("baselineInfo: jumlah hero, match, tanggal terbaru", JSON.stringify(h.baselineInfo()), JSON.stringify({ heroes: 3, matches: 4, updated: "2026-11-10T12:00:00Z" }));
  await h.record("yao", "manual"); await h.record("yao", "manual"); h.newDraft(); await h.record("yao", "manual");
  check("record setelah baseline: used naik", h.used("yao"), 4);
  ctx.window.getHeroPickCount = (s) => h.used(s);
  const R = () => [{ k: "lam", s: { total: 1 } }, { k: "yao", s: { total: 1 } }, { k: "ma-chao", s: { total: 1 } }, { k: "zilong", s: { total: 2 } }];
  const RH2 = { lam: { tier: "S" }, yao: { tier: "S" }, "ma-chao": { tier: "D" }, zilong: { tier: "D" } };
  check("tiebreak: skor dulu, lalu baseline+riwayat paling kecil", B.rank(R(), RH2, "wr", nm).map((r) => r.k).join(","), "zilong,ma-chao,lam,yao");
  await h.removeOne("yao"); await h.removeOne("yao");
  check("tiebreak ikut berubah setelah -1", B.rank(R(), RH2, "wr", nm).map((r) => r.k).join(","), "zilong,ma-chao,yao,lam");
  delete ctx.window.getHeroPickCount;
  check("onBaselineError tidak terpanggil kalau tabel ada", berr, 0);
  h.clear();
  check("logout: baseline kosong", h.used("lam") + "|" + h.baselineInfo(), "0|null");
}
{
  const m = mockClient([{ id: 1, hero_slug: "lam" }]); let berr = 0;
  const h = P.create(m.client, { onBaselineError: () => berr++ }); await h.load();
  check("tabel baseline gagal: riwayat tetap jalan", [h.enabled(), h.used("lam"), h.baselineInfo(), berr].join(), "true,1,,1");
}
{
  const m = mockClient([], { baseline: [] });
  const h = P.create(m.client, {}); await h.load();
  check("baseline kosong: info null", h.baselineInfo(), null);
}
process.exit(fail ? 1 : 0);
