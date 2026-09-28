# Website Romantis Premium — Our Story

Versi premium dengan:
- Opening envelope / surat cinta interaktif
- Animasi buka surat
- Foto utama yang bisa diganti dari Admin
- Floating hearts + sparkle
- Background music + kontrol musik
- Hero photo frame premium
- Timeline kenangan
- Galeri foto/video
- Surat romantis
- Pesan rahasia
- Dashboard admin dengan statistik
- Pengaturan tampilan
- Media Library
- Upload foto/video/audio
- SQLite database
- Responsive mobile

## Menjalankan

```bash
npm install
copy .env.example .env
npm start
```

Linux/macOS:
```bash
cp .env.example .env
npm install
npm start
```

Website: http://localhost:3000
Admin: http://localhost:3000/admin.html

Default:
- Username: admin
- Password: admin123

Segera ubah kredensial di `.env` sebelum dipublikasikan.

## Cara mengisi foto utama
Login Admin → Appearance & Content → Hero Photo → pilih foto → Ganti Foto Utama.

## Cara menambahkan musik
Login Admin → Media Library → pilih Jenis `Musik` → upload MP3/WAV/OGG.
Kemudian tombol musik di website akan memutar lagu tersebut.

## Deployment
Untuk deployment publik, gunakan server Node.js/VPS/platform yang mendukung persistent filesystem.
Folder `data/` dan `uploads/` harus persistent. Untuk skala lebih besar, pindahkan database
ke PostgreSQL/Supabase dan media ke object storage seperti Supabase Storage/Cloudinary.

Jangan masukkan `.env` ke Git.
