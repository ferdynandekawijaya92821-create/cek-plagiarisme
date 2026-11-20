# Aplikasi CekTeks (Android, Windows, macOS, Linux)

Aplikasi ini membungkus `cekteks/dist/CekTeks.html`, yaitu versi mandiri dengan semua pustaka tertanam.
Karena itu, aplikasinya berjalan **offline** dan isinya selalu sama dengan situs web.

| Platform | Teknologi | Berkas |
|---|---|---|
| Android 7+ | [Capacitor](https://capacitorjs.com) (WebView) | `CekTeks-Android.apk` |
| Windows 10/11 | [Electron](https://www.electronjs.org) + electron-builder | `CekTeks-Windows.exe` |
| macOS (Intel & Apple Silicon) | Electron | `CekTeks-macOS.dmg` |
| Linux | Electron | `CekTeks-Linux.AppImage` |

Semua berkas dibangun otomatis oleh [`.github/workflows/apps.yml`](../../.github/workflows/apps.yml) setiap ada
perubahan di `main`, lalu diterbitkan di halaman **Releases** repo ini. Tautan unduhan terbaru selalu tetap:

```
https://github.com/<pemilik>/<repo>/releases/latest/download/CekTeks-Android.apk
```

## Catatan

- **Android**:
  - APK dipasang di luar Play Store, jadi pengguna perlu mengizinkan "Instal dari sumber ini".
  - Laporan PDF, Word, dan ZIP disimpan lewat menu *Bagikan*: Simpan ke perangkat, Drive, WhatsApp, dan lainnya.
  - Tanpa kunci tetap, APK ditandatangani kunci debug yang berbeda di setiap build, sehingga pembaruan harus
    didahului menghapus aplikasi lama. Agar pembaruan bisa langsung dipasang di atas versi lama, buat kunci sekali:
    ```bash
    keytool -genkeypair -v -keystore cekteks.keystore -alias cekteks -keyalg RSA -keysize 2048 -validity 10000
    base64 -w0 cekteks.keystore   # salin hasilnya
    ```
    Lalu tambahkan dua secret di GitHub (Settings → Secrets and variables → Actions):
    `ANDROID_KEYSTORE_BASE64` (hasil base64) dan `ANDROID_KEYSTORE_PASSWORD` (kata sandi kunci).
    Simpan berkas kunci dengan aman. Kunci yang hilang tidak bisa diganti tanpa memasang ulang aplikasi.
- **Windows/macOS**: aplikasi belum ditandatangani sertifikat berbayar, sehingga sistem menampilkan peringatan
  saat pertama dibuka. Panduan memasangnya ada di Beranda situs.
- **iPhone/iPad**: Apple tidak mengizinkan pemasangan di luar App Store. Gunakan Safari → Bagikan →
  *Tambahkan ke Layar Utama* (PWA, tetap bisa offline).

## Membangun sendiri

```bash
python cekteks/web/build.py                     # menghasilkan cekteks/dist/CekTeks.html
# Desktop
cd cekteks/app/desktop && mkdir -p app && cp ../../dist/CekTeks.html app/index.html
npm install && npx electron-builder              # hasil di dist/
# Android (butuh JDK 17 dan Android SDK)
cd cekteks/app/mobile && mkdir -p www && cp ../../dist/CekTeks.html www/index.html
npm install && npx cap add android && npx capacitor-assets generate --android && npx cap sync android
cd android && ./gradlew assembleDebug
```
