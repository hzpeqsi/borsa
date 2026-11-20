"use strict";

/* ---------- Kayıt (yalnızca bu telefonda) ---------- */
const depo = {
  oku(anahtar, varsayilan) {
    try {
      const v = localStorage.getItem("borsa." + anahtar);
      return v ? JSON.parse(v) : varsayilan;
    } catch { return varsayilan; }
  },
  yaz(anahtar, deger) {
    try { localStorage.setItem("borsa." + anahtar, JSON.stringify(deger)); } catch {}
  },
};

let liste = depo.oku("liste", ["THYAO", "ASELS", "GARAN", "BIMAS", "EREGL"]);
let portfoy = depo.oku("portfoy", []);   // {id, kod, adet, alis}
let alarmlar = depo.oku("alarmlar", []); // {id, kod, yon: "ust"|"alt", hedef, gerceklesti, gorulmedi}
let veri = depo.oku("sonVeri", null);
let sekme = "liste";
let donem = depo.oku("donem", "3A");
let yukleniyor = false;
let yuklemeHatasi = false;
const yigin = []; // açık katmanlar (detay, arama, formlar)

const kaydet = () => { depo.yaz("liste", liste); depo.yaz("portfoy", portfoy); depo.yaz("alarmlar", alarmlar); };
const yeniId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- Biçimlendirme ---------- */
const s2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const s0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const tl = (x) => (x == null || isNaN(x) ? "–" : s2.format(x) + " TL");
const sayi = (x) => (x == null || isNaN(x) ? "–" : s2.format(x));
const yuzde = (x) => (x == null || isNaN(x) ? "–" : "%" + s2.format(Math.abs(x)));
const isaretli = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + s2.format(Math.abs(x));
const yon = (x) => (x > 0.004 ? "arti" : x < -0.004 ? "eksi" : "sabit");
const ok = (x) => (x > 0.004 ? "▲ " : x < -0.004 ? "▼ " : "");
const rozet = (x) => `<span class="rozet ${yon(x)}">${ok(x)}${yuzde(x)}</span>`;
const kisaHacim = (x) => {
  if (!x) return "–";
  if (x >= 1e9) return s2.format(x / 1e9) + " milyar";
  if (x >= 1e6) return s2.format(x / 1e6) + " milyon";
  return s0.format(x);
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ayAdlari = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const kisaTarih = (iso) => { const [y, a, g] = iso.split("-"); return `${+g} ${ayAdlari[+a - 1]} ${y.slice(2)}`; };
const guncellemeYazisi = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const gun = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
  const saat = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${gun}, ${saat}`;
};
const sayiOku = (s) => {
  s = String(s || "").trim().replace(/\s/g, "").replace(/tl$/i, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
};
const kucuk = (s) => s.toLocaleLowerCase("tr-TR");

/* ---------- Veri ---------- */
const hisse = (kod) => veri?.hisseler?.[kod] || veri?.endeksler?.[kod] || null;

function seri(kod) {
  const h = hisse(kod);
  if (!h || !veri.tarihler) return [];
  const out = [];
  h.gecmis.forEach((c, i) => { if (c != null) out.push({ t: veri.tarihler[i], c }); });
  return out;
}
const donemGun = { "1A": 22, "3A": 66, "6A": 126, "1Y": 9999 };
function donemDegisimi(kod, gunSayisi) {
  const s = seri(kod);
  if (s.length < 2) return null;
  const bas = s[Math.max(0, s.length - 1 - gunSayisi)].c;
  return ((s[s.length - 1].c - bas) / bas) * 100;
}

async function verileriYukle() {
  yukleniyor = true; yuklemeHatasi = false; ciz();
  try {
    const yanit = await fetch("data/fiyatlar.json?v=" + Date.now(), { cache: "no-store" });
    if (!yanit.ok) throw new Error(yanit.status);
    veri = await yanit.json();
    depo.yaz("sonVeri", veri);
    alarmlariKontrolEt();
  } catch {
    yuklemeHatasi = true;
  }
  yukleniyor = false;
  ciz();
  katmanCiz();
}

function alarmlariKontrolEt() {
  let degisti = false;
  for (const a of alarmlar) {
    const h = hisse(a.kod);
    if (!h || a.gerceklesti) continue;
    if ((a.yon === "ust" && h.fiyat >= a.hedef) || (a.yon === "alt" && h.fiyat <= a.hedef)) {
      a.gerceklesti = true; a.gorulmedi = true; a.anFiyat = h.fiyat; degisti = true;
    }
  }
  if (degisti) kaydet();
}

/* ---------- Simgeler ---------- */
const ikon = {
  yenile: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  arti: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  geri: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  zil: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  soru: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
};

/* ---------- Ana ekran ---------- */
const uygulama = document.getElementById("uygulama");

function ustKisim(baslik) {
  const guncel = veri ? `Fiyatlar: ${esc(guncellemeYazisi(veri.guncelleme))}` : "";
  return `
    <header class="ust">
      <div>
        <h1>${baslik}</h1>
        <div class="guncel">${yukleniyor ? "Yenileniyor…" : guncel}</div>
      </div>
      <button class="yenile" data-eylem="yenile" aria-label="Fiyatları yenile">${ikon.yenile}Yenile</button>
    </header>
    ${yuklemeHatasi ? `<div class="alarm-bant"><p>Fiyatlar yenilenemedi. İnternet bağlantısını kontrol edip tekrar deneyin.${veri ? " Ekranda son alınan fiyatlar var." : ""}</p></div>` : ""}
    ${alarmBantlari()}`;
}

function alarmBantlari() {
  return alarmlar.filter((a) => a.gorulmedi).map((a) => `
    <div class="alarm-bant" role="alert">
      ${ikon.zil}
      <p>${esc(a.kod)} ${tl(a.hedef)} ${a.yon === "ust" ? "üstüne çıktı" : "altına düştü"}. Şu an ${tl(hisse(a.kod)?.fiyat)}.</p>
      <button class="btn ikincil btn-kucuk" data-eylem="alarm-gordum" data-id="${a.id}">Tamam</button>
    </div>`).join("");
}

function hisseSatiri(kod, altYazi) {
  const h = hisse(kod);
  return `
    <button class="satir" data-eylem="detay" data-kod="${esc(kod)}">
      <div class="sol">
        <div class="kod">${esc(kod)}</div>
        <div class="sirket">${esc(altYazi ?? h?.ad ?? "")}</div>
      </div>
      <div class="sag">
        <div class="fiyat">${h ? sayi(h.fiyat) : "–"}</div>
        ${h ? rozet(h.degisim) : '<span class="rozet sabit">veri yok</span>'}
      </div>
    </button>`;
}

function listeCiz() {
  const e = veri?.endeksler?.XU100;
  return `
    ${ustKisim("Borsa")}
    ${e ? `
      <button class="endeks satir" style="border:0" data-eylem="detay" data-kod="XU100">
        <div class="sol"><div class="ad">BIST 100 endeksi</div><div class="deger">${sayi(e.fiyat)}</div></div>
        <span class="rozet">${ok(e.degisim)}${yuzde(e.degisim)}</span>
      </button>` : ""}
    <div class="baslik">
      <h2>Takip listem</h2>
      <button class="btn ikincil btn-kucuk" data-eylem="ara" data-mod="liste">${ikon.arti}Hisse ekle</button>
    </div>
    <div class="liste">
      ${liste.length ? liste.map((k) => hisseSatiri(k)).join("") : `<p class="bos">Listeniz boş. “Hisse ekle” ile takip etmek istediğiniz hisseleri seçin.</p>`}
    </div>
    <div class="sorular">
      <button data-eylem="sor-genel">${ikon.soru}Claude'a sor: Bugün borsada neler oldu?</button>
    </div>
    <p class="not">Fiyatlar borsa açıkken yaklaşık 15 dakikada bir güncellenir ve 15 dakika kadar gecikmelidir. Yatırım tavsiyesi değildir.</p>`;
}

function portfoyHesapla() {
  let deger = 0, maliyet = 0, gunluk = 0;
  const satirlar = portfoy.map((p) => {
    const h = hisse(p.kod);
    const fiyat = h?.fiyat ?? p.alis;
    const d = fiyat * p.adet, m = p.alis * p.adet;
    deger += d; maliyet += m;
    if (h) gunluk += (h.fiyat - h.oncekiKapanis) * p.adet;
    return { ...p, fiyat, deger: d, kz: d - m, kzYuzde: m ? ((d - m) / m) * 100 : 0 };
  });
  return { satirlar, deger, maliyet, kz: deger - maliyet, kzYuzde: maliyet ? ((deger - maliyet) / maliyet) * 100 : 0, gunluk };
}

function portfoyCiz() {
  const p = portfoyHesapla();
  return `
    ${ustKisim("Portföyüm")}
    ${portfoy.length ? `
      <section class="ozet" aria-label="Portföy özeti">
        <span class="etiket">Toplam değer</span>
        <span class="buyuk">${tl(p.deger)}</span>
        <span class="kz ${yon(p.kz)}-yazi">Toplam kâr/zarar: ${isaretli(p.kz)} TL (${ok(p.kzYuzde)}${yuzde(p.kzYuzde)})</span>
        <span class="etiket">Bugünkü değişim: <b class="${yon(p.gunluk)}-yazi">${isaretli(p.gunluk)} TL</b> · Yatırılan: ${tl(p.maliyet)}</span>
      </section>` : ""}
    <div class="baslik">
      <h2>Hisselerim</h2>
      <button class="btn ikincil btn-kucuk" data-eylem="ara" data-mod="portfoy">${ikon.arti}Alım ekle</button>
    </div>
    <div class="liste">
      ${p.satirlar.length ? p.satirlar.map((s) => `
        <button class="satir" data-eylem="detay" data-kod="${esc(s.kod)}">
          <div class="sol">
            <div class="kod">${esc(s.kod)}</div>
            <div class="sirket">${s0.format(s.adet)} adet · alış ${sayi(s.alis)}</div>
          </div>
          <div class="sag">
            <div class="fiyat">${sayi(s.deger)}</div>
            <span class="rozet ${yon(s.kz)}">${isaretli(s.kz)} TL</span>
          </div>
        </button>`).join("") : `<p class="bos">Henüz alım eklemediniz. “Alım ekle” ile hangi hisseden kaç adet, kaça aldığınızı girin; kâr/zararınız otomatik hesaplanır.</p>`}
    </div>
    ${portfoy.length ? `<div class="sorular"><button data-eylem="sor-portfoy">${ikon.soru}Claude'a sor: Portföyümü değerlendir</button></div>` : ""}
    <p class="not">Portföy bilgileriniz yalnızca bu telefonda saklanır, kimseyle paylaşılmaz.</p>`;
}

function alarmCiz() {
  return `
    ${ustKisim("Alarmlar")}
    <div class="baslik">
      <h2>Fiyat alarmlarım</h2>
      <button class="btn ikincil btn-kucuk" data-eylem="ara" data-mod="alarm">${ikon.arti}Alarm kur</button>
    </div>
    <div class="liste">
      ${alarmlar.length ? alarmlar.map((a) => {
        const h = hisse(a.kod);
        return `
        <div class="satir">
          <div class="sol">
            <div class="kod">${esc(a.kod)}</div>
            <div class="sirket">${tl(a.hedef)} ${a.yon === "ust" ? "üstüne çıkınca" : "altına düşünce"}</div>
            <div class="sirket">Şu an ${tl(h?.fiyat)}</div>
          </div>
          <div class="sag">
            <span class="rozet ${a.gerceklesti ? "arti" : "sabit"}">${a.gerceklesti ? "Gerçekleşti" : "Bekliyor"}</span>
            <button class="sil" data-eylem="alarm-sil" data-id="${a.id}">Sil</button>
          </div>
        </div>`;
      }).join("") : `<p class="bos">Alarm yok. Bir hisse belirlediğiniz fiyata gelince uygulamayı açtığınızda en üstte uyarı görürsünüz.</p>`}
    </div>
    <p class="not">Alarmlar fiyatlar güncellendiğinde kontrol edilir ve uygulamayı açtığınızda gösterilir.</p>`;
}

function ciz() {
  if (!veri && yukleniyor) { uygulama.innerHTML = `<p class="bos">Fiyatlar yükleniyor…</p>`; return; }
  uygulama.innerHTML = sekme === "liste" ? listeCiz() : sekme === "portfoy" ? portfoyCiz() : alarmCiz();
  document.querySelectorAll(".sekmeler button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.sekme === sekme)));
}

/* ---------- Katmanlar (Android geri tuşu ile uyumlu) ---------- */
const katman = document.getElementById("katman");

function ac(k) { yigin.push(k); history.pushState({ k: yigin.length }, ""); katmanCiz(true); }
function kapat() { if (yigin.length) history.back(); }
function degistir(k) { yigin[yigin.length - 1] = k; katmanCiz(true); }
window.addEventListener("popstate", () => { if (yigin.length) { yigin.pop(); katmanCiz(true); ciz(); } });

function katmanCiz(basaDon) {
  const k = yigin[yigin.length - 1];
  if (!k) { katman.innerHTML = ""; document.body.style.overflow = ""; return; }
  document.body.style.overflow = "hidden";
  const icerik = k.tur === "detay" ? detayCiz(k.kod) : k.tur === "ara" ? araCiz(k) : k.tur === "alim" ? alimFormu(k) : alarmFormu(k);
  const kaydirma = katman.firstElementChild?.scrollTop || 0;
  katman.innerHTML = `<div class="katman" role="dialog" aria-modal="true"><div class="sayfa">
    <div><button class="geri" data-eylem="kapat">${ikon.geri}Geri</button></div>
    ${icerik}
  </div></div>`;
  if (!basaDon) katman.firstElementChild.scrollTop = kaydirma;
  if (k.tur === "detay") grafikCiz(k.kod);
  if (k.tur === "ara") {
    const girdi = document.getElementById("arama");
    girdi.value = k.sorgu || "";
    girdi.addEventListener("input", () => { k.sorgu = girdi.value; document.getElementById("sonuclar").innerHTML = aramaSonuclari(k); });
    if (basaDon) girdi.focus();
  }
}

/* ---------- Hisse detayı ---------- */
function detayCiz(kod) {
  const h = hisse(kod);
  if (!h) return `<p class="bos">${esc(kod)} için veri bulunamadı.</p>`;
  const endeks = !!veri.endeksler?.[kod];
  const listede = liste.includes(kod);
  const alimlar = portfoy.filter((p) => p.kod === kod);
  const adet = alimlar.reduce((t, p) => t + p.adet, 0);
  const ort = adet ? alimlar.reduce((t, p) => t + p.adet * p.alis, 0) / adet : 0;
  return `
    <div class="detay-ust">
      <div class="kod">${esc(kod)}</div>
      <div class="sirket">${esc(h.ad)}</div>
    </div>
    <div class="detay-fiyat">
      <span class="fiyat">${endeks ? sayi(h.fiyat) : tl(h.fiyat)}</span>
      ${rozet(h.degisim)}
    </div>

    <section class="kart" aria-label="Fiyat grafiği">
      <div class="grafik-bilgi" id="grafik-bilgi"></div>
      <svg class="grafik" id="grafik" role="img" aria-label="${esc(kod)} fiyat grafiği"></svg>
      <div class="donemler" role="group" aria-label="Grafik dönemi">
        ${["1A", "3A", "6A", "1Y"].map((d) => `<button data-eylem="donem" data-donem="${d}" aria-pressed="${d === donem}">${{ "1A": "1 Ay", "3A": "3 Ay", "6A": "6 Ay", "1Y": "1 Yıl" }[d]}</button>`).join("")}
      </div>
    </section>

    <section class="kart bilgiler" aria-label="Bilgiler">
      <div><span>Önceki kapanış</span><b>${sayi(h.oncekiKapanis)}</b></div>
      <div><span>Günlük aralık</span><b>${sayi(h.gunDusuk)} – ${sayi(h.gunYuksek)}</b></div>
      <div><span>1 yıl en düşük</span><b>${sayi(h.yilDusuk)}</b></div>
      <div><span>1 yıl en yüksek</span><b>${sayi(h.yilYuksek)}</b></div>
      ${endeks ? "" : `<div><span>Günlük hacim</span><b>${kisaHacim(h.hacim)} adet</b></div>`}
      ${adet ? `<div><span>Bende</span><b>${s0.format(adet)} adet</b></div>` : ""}
    </section>

    ${endeks ? "" : `
    <div class="eylemler">
      <button class="btn ${listede ? "ikincil" : "ana"}" data-eylem="${listede ? "listeden-cikar" : "listeye-ekle"}" data-kod="${esc(kod)}">${listede ? "Listemden çıkar" : "Listeme ekle"}</button>
      <button class="btn ikincil" data-eylem="alarm-formu" data-kod="${esc(kod)}">Alarm kur</button>
      <button class="btn ikincil" data-eylem="alim-formu" data-kod="${esc(kod)}" style="grid-column: 1 / -1">Portföyüme alım ekle</button>
    </div>`}

    ${alimlar.length ? `
    <section class="kart" aria-label="Alımlarım">
      <h2 style="font-size:19px;margin:0 0 8px">Bu hissedeki alımlarım</h2>
      ${alimlar.map((p) => {
        const kz = (h.fiyat - p.alis) * p.adet;
        return `<div class="baslik" style="padding:8px 0;border-top:1px solid var(--cizgi)">
          <div><b>${s0.format(p.adet)} adet × ${sayi(p.alis)}</b><div class="${yon(kz)}-yazi" style="font-weight:600">${isaretli(kz)} TL</div></div>
          ${p.silOnay
            ? `<button class="btn tehlike btn-kucuk" data-eylem="alim-sil" data-id="${p.id}">Evet, sil</button>`
            : `<button class="sil" data-eylem="alim-sil-sor" data-id="${p.id}">Sil</button>`}
        </div>`;
      }).join("")}
      <div style="color:var(--soluk);font-size:15px;padding-top:6px">Ortalama alış: ${sayi(ort)}</div>
    </section>` : ""}

    <section aria-label="Claude'a sor">
      <h2 style="font-size:21px;margin:0 0 10px">Claude'a sor</h2>
      <div class="sorular">
        ${(endeks
          ? ["Bugün borsada neler oldu? Kısaca anlat.", "Son dönemdeki endeks hareketini yorumla."]
          : ["Bu şirket ne iş yapıyor? Kısaca anlat.", "Son dönemdeki fiyat hareketini yorumla.", "Bu şirketle ilgili son haberler neler?"]
        ).map((s) => `<button data-eylem="sor" data-kod="${esc(kod)}" data-soru="${esc(s)}">${ikon.soru}${esc(s)}</button>`).join("")}
      </div>
      <form class="form" data-form="serbest-soru" data-kod="${esc(kod)}" style="margin-top:12px">
        <label for="serbest-soru">Kendi sorunuz
          <input id="serbest-soru" name="soru" placeholder="Örn: Temettü veriyor mu?" autocomplete="off">
        </label>
        <button class="btn ana tam" type="submit">Sor</button>
      </form>
      <p class="not" style="margin-top:10px">Soru, bu hissenin güncel bilgileriyle birlikte Claude uygulamasında açılır.</p>
    </section>`;
}

function grafikCiz(kod) {
  const svg = document.getElementById("grafik");
  const bilgi = document.getElementById("grafik-bilgi");
  if (!svg) return;
  const tum = seri(kod);
  const s = tum.slice(-Math.min(tum.length, donemGun[donem] + 1));
  if (s.length < 2) { bilgi.textContent = "Grafik için yeterli veri yok."; return; }

  const W = svg.clientWidth || 340, H = 220;
  const sol = 4, sag = 58, ust = 12, alt = 26;
  const degerler = s.map((p) => p.c);
  let min = Math.min(...degerler), max = Math.max(...degerler);
  const pay = (max - min) * 0.08 || max * 0.01;
  min -= pay; max += pay;
  const x = (i) => sol + (i / (s.length - 1)) * (W - sol - sag);
  const y = (v) => ust + (1 - (v - min) / (max - min)) * (H - ust - alt);
  const degisim = ((s[s.length - 1].c - s[0].c) / s[0].c) * 100;
  const renk = degisim >= 0 ? "var(--artis)" : "var(--dusus)";

  const cizgi = s.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join("");
  const alan = `${cizgi}L${x(s.length - 1).toFixed(1)},${H - alt}L${x(0).toFixed(1)},${H - alt}Z`;
  const izgara = [0, 0.5, 1].map((o) => {
    const v = min + pay + o * (max - min - 2 * pay);
    return `<line x1="${sol}" x2="${W - sag}" y1="${y(v)}" y2="${y(v)}" stroke="var(--cizgi)" stroke-width="1"/>
            <text x="${W - sag + 6}" y="${y(v) + 4}">${sayi(v)}</text>`;
  }).join("");

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs><linearGradient id="dolgu" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${renk}" stop-opacity=".22"/><stop offset="1" stop-color="${renk}" stop-opacity="0"/>
    </linearGradient></defs>
    ${izgara}
    <path d="${alan}" fill="url(#dolgu)" stroke="none"/>
    <path d="${cizgi}" fill="none" stroke="${renk}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="${x(s.length - 1)}" cy="${y(s[s.length - 1].c)}" r="4.5" fill="${renk}"/>
    <text x="${sol}" y="${H - 6}">${kisaTarih(s[0].t)}</text>
    <text x="${W - sag}" y="${H - 6}" text-anchor="end">${kisaTarih(s[s.length - 1].t)}</text>
    <g id="imlec" visibility="hidden">
      <line id="imlec-cizgi" y1="${ust}" y2="${H - alt}" stroke="var(--soluk)" stroke-width="1" stroke-dasharray="3 3"/>
      <circle id="imlec-nokta" r="5" fill="${renk}" stroke="var(--kart)" stroke-width="2"/>
    </g>`;

  const varsayilanBilgi = () => {
    bilgi.innerHTML = `<span>Dönem değişimi</span><b class="${yon(degisim)}-yazi">${ok(degisim)}${yuzde(degisim)}</b>`;
  };
  varsayilanBilgi();

  const imlec = svg.querySelector("#imlec");
  const goster = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(s.length - 1, Math.round(((px - sol) / (W - sol - sag)) * (s.length - 1))));
    imlec.setAttribute("visibility", "visible");
    svg.querySelector("#imlec-cizgi").setAttribute("x1", x(i));
    svg.querySelector("#imlec-cizgi").setAttribute("x2", x(i));
    svg.querySelector("#imlec-nokta").setAttribute("cx", x(i));
    svg.querySelector("#imlec-nokta").setAttribute("cy", y(s[i].c));
    bilgi.innerHTML = `<span>${kisaTarih(s[i].t)}</span><b>${sayi(s[i].c)}</b>`;
  };
  const gizle = () => { imlec.setAttribute("visibility", "hidden"); varsayilanBilgi(); };
  svg.addEventListener("pointerdown", goster);
  svg.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons) goster(e); });
  svg.addEventListener("pointerleave", gizle);
  svg.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") setTimeout(gizle, 1500); });
}

/* ---------- Arama ---------- */
function araCiz(k) {
  const basliklar = { liste: "Listeye hisse ekle", portfoy: "Hangi hisseyi aldınız?", alarm: "Hangi hisse için alarm?" };
  return `
    <h2 style="font-size:24px;margin:0">${basliklar[k.mod]}</h2>
    <input id="arama" class="arama" type="search" placeholder="Kod veya şirket adı yazın" autocomplete="off" aria-label="Hisse ara">
    <div class="liste" id="sonuclar">${aramaSonuclari(k)}</div>`;
}

function aramaSonuclari(k) {
  if (!veri) return `<p class="bos">Fiyatlar henüz yüklenmedi.</p>`;
  const q = kucuk((k.sorgu || "").trim());
  const tumu = Object.values(veri.hisseler);
  const bulunan = tumu.filter((h) => !q || kucuk(h.kod).includes(q) || kucuk(h.ad).includes(q))
    .sort((a, b) => (kucuk(a.kod).startsWith(q) ? 0 : 1) - (kucuk(b.kod).startsWith(q) ? 0 : 1) || a.kod.localeCompare(b.kod));
  if (!bulunan.length) return `<p class="bos">“${esc(k.sorgu)}” bulunamadı. Hisse listede yoksa, kurulumu yapan kişi semboller.txt dosyasına ekleyebilir.</p>`;
  return bulunan.map((h) => {
    const ekli = k.mod === "liste" && liste.includes(h.kod);
    return `
      <button class="satir" data-eylem="sec" data-kod="${esc(h.kod)}" ${ekli ? 'aria-disabled="true"' : ""}>
        <div class="sol"><div class="kod">${esc(h.kod)}</div><div class="sirket">${esc(h.ad)}</div></div>
        <div class="sag">${ekli ? '<span class="rozet sabit">Listede</span>' : `<div class="fiyat">${sayi(h.fiyat)}</div>`}</div>
      </button>`;
  }).join("");
}

/* ---------- Formlar ---------- */
function alimFormu(k) {
  const h = hisse(k.kod);
  return `
    <h2 style="font-size:24px;margin:0">${esc(k.kod)} alımı ekle</h2>
    <p style="margin:0;color:var(--soluk)">${esc(h?.ad || "")} · şu an ${tl(h?.fiyat)}</p>
    <form class="form" data-form="alim" data-kod="${esc(k.kod)}">
      <label for="adet">Kaç adet aldınız?
        <input id="adet" name="adet" inputmode="numeric" placeholder="Örn: 100" autocomplete="off">
      </label>
      <label for="alis">Hisse başına kaç TL'den aldınız?
        <input id="alis" name="alis" inputmode="decimal" value="${h ? s2.format(h.fiyat) : ""}" autocomplete="off">
      </label>
      <p class="hata" id="form-hata" hidden></p>
      <button class="btn ana tam" type="submit">Kaydet</button>
    </form>`;
}

function alarmFormu(k) {
  const h = hisse(k.kod);
  k.yon = k.yon || "ust";
  return `
    <h2 style="font-size:24px;margin:0">${esc(k.kod)} için alarm</h2>
    <p style="margin:0;color:var(--soluk)">${esc(h?.ad || "")} · şu an ${tl(h?.fiyat)}</p>
    <form class="form" data-form="alarm" data-kod="${esc(k.kod)}">
      <div class="secim" role="group" aria-label="Ne zaman uyarılsın?">
        <button type="button" data-eylem="alarm-yon" data-yon="ust" aria-pressed="${k.yon === "ust"}">▲ Üstüne çıkınca</button>
        <button type="button" data-eylem="alarm-yon" data-yon="alt" aria-pressed="${k.yon === "alt"}">▼ Altına düşünce</button>
      </div>
      <label for="hedef">Hedef fiyat (TL)
        <input id="hedef" name="hedef" inputmode="decimal" value="${k.hedef ?? ""}" placeholder="${h ? s2.format(h.fiyat) : ""}" autocomplete="off">
      </label>
      <p class="hata" id="form-hata" hidden></p>
      <button class="btn ana tam" type="submit">Alarmı kur</button>
    </form>`;
}

function formHatasi(mesaj) {
  const el = document.getElementById("form-hata");
  el.textContent = mesaj; el.hidden = false;
}

/* ---------- Claude'a sor ---------- */
function hisseOzeti(kod) {
  const h = hisse(kod);
  if (!h) return "";
  const satirlar = [
    `- ${kod} (${h.ad}), Borsa İstanbul`,
    `- Son fiyat: ${tl(h.fiyat)} · günlük değişim: ${h.degisim >= 0 ? "+" : "−"}%${s2.format(Math.abs(h.degisim))}`,
    `- 1 yıllık en düşük / en yüksek: ${sayi(h.yilDusuk)} / ${sayi(h.yilYuksek)}`,
  ];
  const d = [["1 ay", 22], ["3 ay", 66], ["1 yıl", 9999]].map(([ad, g]) => {
    const v = donemDegisimi(kod, g);
    return v == null ? null : `${ad}: ${v >= 0 ? "+" : "−"}%${s2.format(Math.abs(v))}`;
  }).filter(Boolean);
  if (d.length) satirlar.push(`- Fiyat değişimi → ${d.join(", ")}`);
  const alimlar = portfoy.filter((p) => p.kod === kod);
  if (alimlar.length) {
    const adet = alimlar.reduce((t, p) => t + p.adet, 0);
    const ort = alimlar.reduce((t, p) => t + p.adet * p.alis, 0) / adet;
    satirlar.push(`- Bende ${s0.format(adet)} adet var, ortalama alış ${tl(ort)} (kâr/zarar: ${isaretli((h.fiyat - ort) * adet)} TL)`);
  }
  return satirlar.join("\n");
}

function claudeAc(metin) {
  const tam = `${metin}\n\nLütfen sade bir Türkçeyle, kısa ve anlaşılır cevap ver. Gerekirse güncel bilgi için internette ara.`;
  try { navigator.clipboard?.writeText(tam).catch(() => {}); } catch {}
  const a = document.createElement("a");
  a.href = "https://claude.ai/new?q=" + encodeURIComponent(tam);
  a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  bildir("Claude açılıyor. Soru kopyalandı, gerekirse yapıştırabilirsiniz.");
}

function tarihNotu() {
  return veri ? `(Bilgiler ${guncellemeYazisi(veri.guncelleme)} itibarıyla, yaklaşık 15 dk gecikmeli)` : "";
}

/* ---------- Bildirim ---------- */
let toastZaman;
function bildir(m) {
  const t = document.getElementById("toast");
  t.textContent = m; t.hidden = false;
  clearTimeout(toastZaman);
  toastZaman = setTimeout(() => (t.hidden = true), 3200);
}

/* ---------- Olaylar ---------- */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-eylem]");
  if (!el) return;
  const { eylem, kod, id } = el.dataset;
  const ust = yigin[yigin.length - 1];

  switch (eylem) {
    case "yenile": verileriYukle(); break;
    case "kapat": kapat(); break;
    case "detay": ac({ tur: "detay", kod }); break;
    case "ara": ac({ tur: "ara", mod: el.dataset.mod, sorgu: "" }); break;
    case "sec":
      if (el.getAttribute("aria-disabled") === "true") break;
      if (ust.mod === "liste") {
        liste.push(kod); kaydet(); bildir(`${kod} listenize eklendi`); kapat();
      } else if (ust.mod === "portfoy") degistir({ tur: "alim", kod });
      else degistir({ tur: "alarm", kod });
      break;
    case "donem":
      donem = el.dataset.donem; depo.yaz("donem", donem);
      document.querySelectorAll(".donemler button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.donem === donem)));
      grafikCiz(ust.kod);
      break;
    case "listeye-ekle": if (!liste.includes(kod)) liste.push(kod); kaydet(); bildir(`${kod} listenize eklendi`); katmanCiz(); break;
    case "listeden-cikar": liste = liste.filter((k) => k !== kod); kaydet(); bildir(`${kod} listenizden çıkarıldı`); katmanCiz(); break;
    case "alim-formu": ac({ tur: "alim", kod }); break;
    case "alarm-formu": ac({ tur: "alarm", kod }); break;
    case "alarm-yon": {
      ust.yon = el.dataset.yon;
      ust.hedef = document.getElementById("hedef").value;
      el.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
      break;
    }
    case "alim-sil-sor": portfoy.forEach((p) => (p.silOnay = p.id === id)); katmanCiz(); break;
    case "alim-sil":
      portfoy = portfoy.filter((p) => p.id !== id); portfoy.forEach((p) => delete p.silOnay);
      kaydet(); bildir("Alım silindi"); katmanCiz(); break;
    case "alarm-sil": alarmlar = alarmlar.filter((a) => a.id !== id); kaydet(); bildir("Alarm silindi"); ciz(); break;
    case "alarm-gordum": {
      const a = alarmlar.find((x) => x.id === id);
      if (a) a.gorulmedi = false;
      kaydet(); ciz(); break;
    }
    case "sor": claudeAc(`${el.dataset.soru}\n\n${hisse(kod)?.ad || kod} hakkında soruyorum. ${tarihNotu()}\n${hisseOzeti(kod)}`); break;
    case "sor-genel": {
      const e100 = veri?.endeksler?.XU100;
      const satirlar = liste.map((k) => hisse(k)).filter(Boolean).map((h) => `- ${h.kod}: ${tl(h.fiyat)} (${h.degisim >= 0 ? "+" : "−"}%${s2.format(Math.abs(h.degisim))})`);
      claudeAc(`Bugün Borsa İstanbul'da neler oldu? Kısaca anlat. ${tarihNotu()}\n- BIST 100: ${sayi(e100?.fiyat)} (${e100 ? (e100.degisim >= 0 ? "+" : "−") + "%" + s2.format(Math.abs(e100.degisim)) : "–"})\n\nTakip ettiğim hisseler:\n${satirlar.join("\n")}`);
      break;
    }
    case "sor-portfoy": {
      const p = portfoyHesapla();
      const satirlar = p.satirlar.map((s) => `- ${s.kod} (${hisse(s.kod)?.ad || ""}): ${s0.format(s.adet)} adet, alış ${tl(s.alis)}, şu an ${tl(s.fiyat)}, kâr/zarar ${isaretli(s.kz)} TL`);
      claudeAc(`Hisse portföyümü değerlendirir misin? Dağılımı, riskleri ve dikkat etmem gerekenleri sade bir dille anlat. ${tarihNotu()}\n\n${satirlar.join("\n")}\n\nToplam değer: ${tl(p.deger)}, toplam kâr/zarar: ${isaretli(p.kz)} TL`);
      break;
    }
  }
});

document.addEventListener("submit", (e) => {
  const f = e.target.closest("[data-form]");
  if (!f) return;
  e.preventDefault();
  const kod = f.dataset.kod;

  if (f.dataset.form === "alim") {
    const adet = sayiOku(f.adet.value), alis = sayiOku(f.alis.value);
    if (!(adet > 0)) return formHatasi("Adet sayısını yazın (örn: 100).");
    if (!(alis > 0)) return formHatasi("Alış fiyatını yazın (örn: 152,50).");
    portfoy.push({ id: yeniId(), kod, adet, alis });
    kaydet(); bildir(`${kod} alımı portföye eklendi`); kapat();
  } else if (f.dataset.form === "alarm") {
    const hedef = sayiOku(f.hedef.value);
    if (!(hedef > 0)) return formHatasi("Hedef fiyatı yazın (örn: 160).");
    const ust = yigin[yigin.length - 1];
    const y = ust.yon || "ust";
    const simdi = hisse(kod)?.fiyat;
    if (simdi != null && y === "ust" && simdi >= hedef)
      return formHatasi(`${kod} zaten ${tl(hedef)} üstünde (şu an ${tl(simdi)}). Daha yüksek bir fiyat yazın.`);
    if (simdi != null && y === "alt" && simdi <= hedef)
      return formHatasi(`${kod} zaten ${tl(hedef)} altında (şu an ${tl(simdi)}). Daha düşük bir fiyat yazın.`);
    alarmlar.push({ id: yeniId(), kod, yon: y, hedef, gerceklesti: false, gorulmedi: false });
    kaydet(); alarmlariKontrolEt(); bildir(`Alarm kuruldu: ${kod} ${tl(hedef)}`); kapat();
  } else if (f.dataset.form === "serbest-soru") {
    const soru = f.soru.value.trim();
    if (!soru) { f.soru.focus(); return; }
    claudeAc(`${soru}\n\n${hisse(kod)?.ad || kod} hakkında soruyorum. ${tarihNotu()}\n${hisseOzeti(kod)}`);
  }
});

document.querySelectorAll(".sekmeler button").forEach((b) =>
  b.addEventListener("click", () => {
    const n = yigin.length;
    yigin.length = 0;
    if (n) history.go(-n);
    katmanCiz();
    sekme = b.dataset.sekme; ciz(); window.scrollTo(0, 0);
  })
);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !yukleniyor) verileriYukle();
});

/* ---------- Başlat ---------- */
if (veri) alarmlariKontrolEt();
ciz();
verileriYukle();
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
