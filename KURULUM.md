# Borsa Takip: Kurulum Rehberi

Uygulama GitHub'da ücretsiz yayınlanır. Fiyatlar hafta içi borsa açıkken (10:00–18:15) yaklaşık 15 dakikada bir otomatik güncellenir. Bilgisayarınızın açık olmasına gerek yoktur.

Kurulum bir kez yapılır ve yaklaşık 15 dakika sürer.

## 1. GitHub hesabı açın

1. https://github.com/signup adresine gidin ve ücretsiz bir hesap açın.
2. Kullanıcı adınızı not edin. Uygulamanın adresinde bu ad geçecek.

## 2. Depoyu (repository) oluşturun

1. Sağ üstteki **+** → **New repository**.
2. **Repository name:** `borsa`
3. **Public** seçili kalsın. GitHub Pages ücretsiz planda yalnızca açık (public) depolarda çalışır. Babanızın portföyü buraya yüklenmez, sadece telefonunda saklanır.
4. **Create repository**.

## 3. Dosyaları yükleyin

1. Açılan sayfada **uploading an existing file** bağlantısına tıklayın.
2. `borsa-takip` klasörünün **içindeki her şeyi** (klasörün kendisini değil) tarayıcıya sürükleyip bırakın: `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, ikonlar, `semboller.txt`, `data`, `scripts` ve `.github` klasörleri.
3. **Commit changes**.

> **`.github` klasörü yüklenmezse:** **Add file → Create new file** deyin, dosya adına
> `.github/workflows/fiyatlari-guncelle.yml` yazın ve bu dosyanın içeriğini yapıştırıp kaydedin.

## 4. Sayfayı yayına alın

1. Deponun üstündeki **Settings** → soldaki **Pages**.
2. **Source:** *Deploy from a branch*, **Branch:** `main` ve `/ (root)` → **Save**.
3. 1–2 dakika sonra adres hazır olur:
   **`https://KULLANICI-ADINIZ.github.io/borsa/`**

## 5. Otomatik güncellemeyi deneyin

1. Deponun üstündeki **Actions** sekmesi. Bir onay butonu çıkarsa onaylayın.
2. Soldan **Fiyatları güncelle** → sağdaki **Run workflow** → **Run workflow**.
3. Yaklaşık 1 dakika sonra yeşil tik çıkarsa her şey çalışıyor demektir. Bundan sonra fiyatlar kendiliğinden güncellenir.

## 6. Babanızın telefonuna ekleyin

Adresi babanızın telefonunda açın, sonra:

- **Android (Chrome):** sağ üstteki **⋮** → **Ana ekrana ekle** (veya **Uygulamayı yükle**)
- **iPhone (Safari):** alttaki **Paylaş** simgesi → **Ana Ekrana Ekle**

Telefonda "Borsa" adında bir simge oluşur, uygulama gibi açılır.

**"Claude'a sor" butonu için:** Babanızın telefonunda Claude uygulaması kurulu olsun ve kendi ücretsiz hesabıyla oturum açsın. Butona basınca soru, hissenin güncel bilgileriyle birlikte Claude'da açılır. Soru aynı zamanda panoya kopyalanır, gerekirse yapıştırılabilir.

---

## Bilmekte fayda var

- **Fiyatlar yaklaşık 15 dakika gecikmelidir** (kaynak: Yahoo Finance) ve borsa açıkken yaklaşık 15 dakikada bir güncellenir. GitHub yoğun saatlerde bu işleri 5–15 dakika geç başlatabilir. Anlık al-sat için değil, takip için uygundur.
- **Yeni hisse eklemek:** Uygulamada aranabilen ~100 hisse var. Listede olmayan bir hisse için GitHub'da `semboller.txt` dosyasını açın, kalem simgesine basın ve `KOD Şirket adı` şeklinde bir satır ekleyin. Bir sonraki güncellemeden sonra uygulamada görünür.
- **Güncelleme saatlerini değiştirmek:** `.github/workflows/fiyatlari-guncelle.yml` dosyasındaki `cron` satırları. Saatler UTC'dir, Türkiye saatinden 3 saat geridir.
- **Alarmlar** fiyatlar güncellendiğinde kontrol edilir. Telefona bildirim gelmez, uygulama açılınca en üstte sarı uyarı olarak görünür.
- **Portföy, takip listesi ve alarmlar** yalnızca o telefonda saklanır. Tarayıcı verileri silinirse kaybolur.
- **Fiyatlar güncellenmiyorsa:** GitHub, 60 gün boyunca depoda hiçbir değişiklik olmazsa zamanlanmış işleri durdurabilir ve öncesinde e-posta gönderir. **Actions** sekmesinden **Enable workflow** demeniz yeterli.
- Bu uygulama yatırım tavsiyesi vermez.
