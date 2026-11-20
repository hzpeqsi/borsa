"""BIST fiyatlarını Yahoo Finance'ten çekip data/fiyatlar.json dosyasına yazar.

Sadece Python standart kütüphanesi kullanır. GitHub Actions bu betiği günde
birkaç kez çalıştırır; elle çalıştırmak için:  python scripts/fiyat_cek.py
"""
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone, timedelta

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEMBOL_DOSYASI = os.path.join(KOK, "semboller.txt")
CIKTI = os.path.join(KOK, "data", "fiyatlar.json")
TR = timezone(timedelta(hours=3))

ENDEKSLER = [("XU100", "BIST 100"), ("XU030", "BIST 30")]
HOSTLAR = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def sembolleri_oku():
    liste = []
    with open(SEMBOL_DOSYASI, encoding="utf-8") as f:
        for satir in f:
            satir = satir.strip()
            if not satir or satir.startswith("#"):
                continue
            parca = satir.split(None, 1)
            kod = parca[0].upper()
            ad = parca[1].strip() if len(parca) > 1 else kod
            liste.append((kod, ad))
    return liste


def getir(kod):
    hata = None
    for deneme in range(3):
        host = HOSTLAR[deneme % len(HOSTLAR)]
        url = f"https://{host}/v8/finance/chart/{kod}.IS?range=1y&interval=1d"
        try:
            istek = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(istek, timeout=20) as yanit:
                veri = json.load(yanit)
            sonuc = veri["chart"]["result"]
            if not sonuc:
                raise ValueError("boş sonuç")
            return sonuc[0]
        except Exception as e:  # ağ hatası, 429, bilinmeyen sembol...
            hata = e
            time.sleep(1.5 * (deneme + 1))
    raise RuntimeError(f"{kod}: {hata}")


def gun(ts):
    return datetime.fromtimestamp(ts, TR).strftime("%Y-%m-%d")


def isle(kod, ad, r):
    meta = r["meta"]
    zamanlar = r.get("timestamp") or []
    kapanislar = r["indicators"]["quote"][0].get("close") or []
    seri = [(gun(t), round(c, 2)) for t, c in zip(zamanlar, kapanislar) if c is not None]
    if not seri:
        raise ValueError(f"{kod}: fiyat geçmişi yok")

    fiyat = meta.get("regularMarketPrice") or seri[-1][1]
    piyasa_gunu = gun(meta.get("regularMarketTime", zamanlar[-1]))
    # Son çubuk bugüne aitse önceki kapanış bir önceki çubuktur.
    if seri[-1][0] == piyasa_gunu:
        onceki = seri[-2][1] if len(seri) > 1 else fiyat
    else:
        onceki = seri[-1][1]
        seri.append((piyasa_gunu, round(fiyat, 2)))
    degisim = (fiyat - onceki) / onceki * 100 if onceki else 0

    return {
        "kod": kod,
        "ad": ad,
        "fiyat": round(fiyat, 2),
        "oncekiKapanis": round(onceki, 2),
        "degisim": round(degisim, 2),
        "gunYuksek": meta.get("regularMarketDayHigh"),
        "gunDusuk": meta.get("regularMarketDayLow"),
        "yilYuksek": meta.get("fiftyTwoWeekHigh"),
        "yilDusuk": meta.get("fiftyTwoWeekLow"),
        "hacim": meta.get("regularMarketVolume"),
        "piyasaZamani": datetime.fromtimestamp(meta.get("regularMarketTime", zamanlar[-1]), TR).isoformat(),
        "gecmis": {"t": [s[0] for s in seri], "c": [s[1] for s in seri]},
    }


def main():
    hisseler, endeksler, hatalar = {}, {}, []
    for kod, ad in ENDEKSLER:
        try:
            endeksler[kod] = isle(kod, ad, getir(kod))
        except Exception as e:
            hatalar.append(str(e))
    for kod, ad in sembolleri_oku():
        try:
            hisseler[kod] = isle(kod, ad, getir(kod))
        except Exception as e:
            hatalar.append(str(e))
        time.sleep(0.3)

    if len(hisseler) < 5:
        # Yahoo geçici olarak engellediyse eski dosyayı bozma.
        print("Yeterli veri alınamadı, dosya güncellenmedi.", hatalar[:5], file=sys.stderr)
        sys.exit(1)

    # Dosyayı küçük tutmak için tarihleri tek bir listede topla,
    # her hisse için yalnızca bu tarihlere hizalı kapanışları sakla.
    tum = list(endeksler.values()) + list(hisseler.values())
    tarihler = sorted({t for h in tum for t in h["gecmis"]["t"]})
    sira = {t: i for i, t in enumerate(tarihler)}
    for h in tum:
        dizi = [None] * len(tarihler)
        for t, c in zip(h["gecmis"]["t"], h["gecmis"]["c"]):
            dizi[sira[t]] = c
        h["gecmis"] = dizi

    os.makedirs(os.path.dirname(CIKTI), exist_ok=True)
    cikti = {
        "guncelleme": datetime.now(TR).isoformat(timespec="minutes"),
        "kaynak": "Yahoo Finance (yaklaşık 15 dk gecikmeli)",
        "tarihler": tarihler,
        "endeksler": endeksler,
        "hisseler": hisseler,
        "hatalar": hatalar,
    }
    with open(CIKTI, "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(hisseler)} hisse, {len(endeksler)} endeks yazıldı. Hata: {len(hatalar)}")
    for h in hatalar:
        print("  -", h)


if __name__ == "__main__":
    main()
