require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "romantis.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  story TEXT NOT NULL,
  image TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('photo','video','audio')),
  title TEXT NOT NULL,
  caption TEXT DEFAULT '',
  filename TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const defaults = {
  site_title: "Untuk Kamu, Seseorang yang Berarti",
  hero_subtitle: "Setiap kenangan bersamamu layak untuk disimpan.",
  letter_title: "Untuk Kamu...",
  letter_text: "Mungkin aku tidak selalu pandai mengungkapkan apa yang aku rasakan. Tetapi melalui halaman kecil ini, aku ingin menyimpan semua cerita, tawa, dan kenangan yang pernah kita lalui bersama. Terima kasih sudah menjadi bagian dari ceritaku.",
  start_date: "2025-01-01",
  secret_message: "Kalau kamu sampai menemukan pesan ini, berarti kamu benar-benar membaca semuanya. ❤️",
  music_label: "Our Song",
  accent: "#b76e79",
  hero_image: ""
};

const insertSetting = db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)");
for (const [k,v] of Object.entries(defaults)) insertSetting.run(k,v);

const getSettings = () => Object.fromEntries(
  db.prepare("SELECT key,value FROM settings").all().map(r => [r.key,r.value])
);

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly:true, sameSite:"lax", secure: process.env.NODE_ENV === "production", maxAge: 1000*60*60*8 }
}));

function adminOnly(req,res,next){
  if(req.session && req.session.admin) return next();
  return res.status(401).json({error:"Unauthorized"});
}

const storage = multer.diskStorage({
  destination: (_req,_file,cb) => cb(null, UPLOAD_DIR),
  filename: (_req,file,cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = Date.now()+"-"+Math.random().toString(36).slice(2,10)+ext;
    cb(null,safe);
  }
});

const upload = multer({
  storage,
  limits:{fileSize: 200 * 1024 * 1024},
  fileFilter: (_req,file,cb) => {
    const ok = [
      "image/jpeg","image/png","image/webp","image/gif",
      "video/mp4","video/webm",
      "audio/mpeg","audio/wav","audio/ogg"
    ].includes(file.mimetype);
    cb(ok ? null : new Error("Format file tidak didukung"), ok);
  }
});

app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(ROOT,"public")));

app.get("/api/public", (req,res) => {
  const settings = getSettings();
  const timeline = db.prepare("SELECT * FROM timeline ORDER BY date ASC, id ASC").all();
  const photos = db.prepare("SELECT * FROM media WHERE type='photo' ORDER BY id DESC").all();
  const videos = db.prepare("SELECT * FROM media WHERE type='video' ORDER BY id DESC").all();
  const audio = db.prepare("SELECT * FROM media WHERE type='audio' ORDER BY id DESC LIMIT 1").get();
  res.json({settings,timeline,photos,videos,audio});
});

app.post("/api/login", async (req,res) => {
  const {username,password} = req.body || {};
  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "admin123";
  if(username !== adminUser || password !== adminPass){
    return res.status(401).json({error:"Username atau password salah"});
  }
  req.session.admin = true;
  res.json({success:true});
});

app.post("/api/logout", (req,res) => {
  req.session.destroy(()=>res.json({success:true}));
});

app.get("/api/admin/me", adminOnly, (_req,res) => res.json({authenticated:true}));

app.post("/api/hero-image", adminOnly, upload.single("file"), (req,res) => {
  if(!req.file) return res.status(400).json({error:"Foto wajib diunggah"});
  const old = getSettings().hero_image;
  const stmt = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  stmt.run("hero_image", req.file.filename);
  if(old && !old.startsWith("/")) {
    const oldPath = path.join(UPLOAD_DIR, old);
    if(fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  res.json({success:true,filename:req.file.filename});
});

app.put("/api/settings", adminOnly, (req,res) => {
  const allowed = Object.keys(defaults);
  const stmt = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  const tx = db.transaction(() => {
    for(const key of allowed){
      if(req.body[key] !== undefined) stmt.run(key,String(req.body[key]));
    }
  });
  tx();
  res.json({success:true,settings:getSettings()});
});

app.post("/api/timeline", adminOnly, (req,res) => {
  const {date,title,story,image=""} = req.body;
  if(!date || !title || !story) return res.status(400).json({error:"Tanggal, judul, dan cerita wajib diisi"});
  const info = db.prepare("INSERT INTO timeline(date,title,story,image) VALUES(?,?,?,?)").run(date,title,story,image);
  res.json({success:true,id:info.lastInsertRowid});
});

app.put("/api/timeline/:id", adminOnly, (req,res) => {
  const {date,title,story,image=""} = req.body;
  db.prepare("UPDATE timeline SET date=?,title=?,story=?,image=? WHERE id=?").run(date,title,story,image,req.params.id);
  res.json({success:true});
});

app.delete("/api/timeline/:id", adminOnly, (req,res) => {
  db.prepare("DELETE FROM timeline WHERE id=?").run(req.params.id);
  res.json({success:true});
});

app.post("/api/media", adminOnly, upload.single("file"), (req,res) => {
  if(!req.file) return res.status(400).json({error:"File wajib diunggah"});
  const {type,title="",caption=""} = req.body;
  if(!["photo","video","audio"].includes(type)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({error:"Jenis media tidak valid"});
  }
  const info = db.prepare("INSERT INTO media(type,title,caption,filename) VALUES(?,?,?,?)")
    .run(type,title || "Kenangan",caption,req.file.filename);
  res.json({success:true,id:info.lastInsertRowid});
});

app.delete("/api/media/:id", adminOnly, (req,res) => {
  const row = db.prepare("SELECT * FROM media WHERE id=?").get(req.params.id);
  if(row){
    const file = path.join(UPLOAD_DIR,row.filename);
    if(fs.existsSync(file)) fs.unlinkSync(file);
    db.prepare("DELETE FROM media WHERE id=?").run(req.params.id);
  }
  res.json({success:true});
});

app.use((err,_req,res,_next) => {
  console.error(err);
  res.status(400).json({error:err.message || "Terjadi kesalahan"});
});

app.listen(PORT, () => console.log(`Website romantis berjalan di http://localhost:${PORT}`));
