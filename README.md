# 🏓 Neon Pong 2.0

Versi modern dari game klasik Pong, ditulis ulang dari nol dengan **TypeScript**, **Vite**, dan API web terbaru. Visual neon dengan efek *bloom*, fisika presisi, AI yang bisa memprediksi pantulan, mode 2 pemain, dukungan gamepad & layar sentuh, serta bisa diinstal sebagai aplikasi (PWA).

## ✨ Fitur

**Gameplay**
- **Mode VS CPU** dengan 4 tingkat kesulitan (Mudah, Normal, Sulit, Gila). AI memprediksi pantulan dinding, punya waktu reaksi dan kesalahan bidik yang realistis.
- **Mode 2 Pemain lokal**: keyboard, dua gamepad, atau layar sentuh yang dibagi dua (multi-touch).
- **Spin**: gerakkan paddle saat memukul untuk membelokkan bola.
- Bola makin cepat di setiap pukulan, sudut pantulan bergantung pada titik kontak.
- Pilihan poin untuk menang (5 / 7 / 11), penghitung *rally*, dan statistik (menang/kalah, rally terbaik) yang tersimpan.

**Teknologi & kualitas**
- **Fisika fixed-timestep 120 Hz** terpisah dari render, dengan *sub-stepping* sehingga bola tidak pernah menembus paddle di kecepatan tinggi.
- **Canvas 2D HiDPI** dengan *bloom* (blur + additive), jejak bola yang berubah warna sesuai kecepatan, partikel berbasis *object pool*, *screen shake* berbasis trauma, dan *hit-stop*.
- **Web Audio API**: semua efek suara disintesis secara prosedural (tanpa file audio) dan di-*pan* stereo sesuai posisi bola.
- **Gamepad API** (termasuk getaran/rumble) dan **Vibration API** di ponsel.
- **Pointer Events** untuk mouse & multi-touch, **View Transitions API** untuk transisi menu.
- CSS modern: `@layer`, *container queries*, `:has()`, `oklch()`, `color-mix()`, `dvh`, *safe-area insets*.
- **PWA**: manifest + service worker, bisa dimainkan offline dan diinstal ke layar utama.
- Aksesibilitas: navigasi keyboard penuh, `aria-live` pada skor, menghormati `prefers-reduced-motion`.
- Otomatis jeda saat tab disembunyikan.

## 🎮 Kontrol

| Aksi | Pemain 1 | Pemain 2 |
| --- | --- | --- |
| Gerak | `W` / `S` (mode CPU: juga `↑` / `↓`) | `↑` / `↓` |
| Mouse / sentuh | Gerakkan di lapangan (mode 2P: separuh kiri) | Separuh kanan lapangan |
| Gamepad | Stik kiri / D-pad (gamepad #1) | Gamepad #2 |
| Jeda | `Space` / `Esc` / `P` / tombol `Start` | |
| Mulai / konfirmasi | `Enter` / tombol `A` | |

## 🚀 Menjalankan

Butuh **Node.js 20.19+ atau 22.12+**.

```bash
npm install
npm run dev        # server pengembangan dengan hot reload
npm test           # unit test fisika & AI (Vitest)
npm run build      # typecheck + build produksi ke dist/
npm run preview    # menjalankan hasil build
```

Workflow GitHub Actions (`.github/workflows/deploy.yml`) menjalankan test & build pada setiap push/PR, lalu men-deploy ke **GitHub Pages** dari branch `main`. Aktifkan di *Settings → Pages → Source: GitHub Actions*.

## 🛠️ Struktur Proyek

```
index.html               Markup HUD & menu
public/                  Ikon, manifest PWA, service worker
src/
  main.ts                Bootstrap, UI menu, penyimpanan pengaturan
  style.css              Gaya neon & layout responsif
  storage.ts             Pengaturan & statistik di localStorage
  game/
    config.ts            Konstanta dunia, bola, paddle, profil AI
    types.ts             Tipe bersama
    physics.ts           Fisika murni (tabrakan, prediksi) — mudah dites
    ai.ts                Lawan CPU
    input.ts             Keyboard, pointer/sentuh, gamepad
    audio.ts             Efek suara Web Audio
    particles.ts         Sistem partikel
    renderer.ts          Render Canvas + bloom
    game.ts              Game loop & state machine
    *.test.ts            Unit test (Vitest)
```

---
*Dibuat dengan ❤️ untuk pecinta game retro.*
