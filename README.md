# HoK S16 Build Site

Proses craft menampilkan item **setengah jadi** (komponen/mid) dan **aktif** dari sheet `build.md` (12 preset) bila ada; dari sheet build.md (12 preset).

Buka index.html atau https://huseinnabil1997.github.io/hok-builds/

## Ban & Pick

Tier hero diambil dari HoK Camp [hero hot list](https://camp.honorofkings.com/h5/app/index.html#/hero-hot-list) (filter All Tiers + All), urutan S > A > B > C. Update mingguan:

1. Buka halaman hot list, pastikan filter All Tiers + All, catat tanggal Update (contoh `11/6/2026` = 6 Nov 2026).
2. Simpan tabel jadi CSV kolom `lane,hero,tier,wr,pr,br`. Jangan commit CSV mentah.
3. Dari root repo:

```
node scripts/build-camp-tier.mjs path/ke/hotlist.csv "6 Nov 2026" && node scripts/build-banpick-merged.mjs && node scripts/test-banpick.mjs
```

4. Kalau tes lulus, bump `?v=` `data/banpick-merged.js` di `index.html` dan `banpick.html`, lalu commit.
