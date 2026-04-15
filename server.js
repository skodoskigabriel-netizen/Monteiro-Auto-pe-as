const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const app = express();

// 🔓 middlewares
app.use(cors());
app.use(express.json());

// 🌐 frontend (IMPORTANTE)
app.use(express.static("public"));

// 📁 imagens
app.use("/uploads", express.static("uploads"));

// 📦 upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

// 🗄️ banco
const db = new sqlite3.Database("banco.db");

// 📦 tabelas
db.run(`
CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT,
  preco REAL,
  marca TEXT,
  tipo TEXT,
  imagem TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS vendas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER,
  nome TEXT,
  preco REAL,
  data DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// 🔐 sessões
const sessions = {};

// 🔐 LOGIN
app.post("/login", (req, res) => {
  const { user, pass } = req.body;

  if (user === "admin" && pass === "1234") {
    const token = crypto.randomBytes(24).toString("hex");

    sessions[token] = true;

    return res.json({
      ok: true,
      token
    });
  }

  res.json({ ok: false });
});

// 🛡️ AUTH
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token || !sessions[token]) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  next();
}

// 📦 LISTAR (público)
app.get("/produtos", (req, res) => {
  db.all("SELECT * FROM produtos", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ➕ ADD
app.post("/produtos", auth, upload.single("imagem"), (req, res) => {
  const { nome, preco, marca, tipo } = req.body;
  const imagem = req.file ? "/uploads/" + req.file.filename : "";

  db.run(
    "INSERT INTO produtos (nome, preco, marca, tipo, imagem) VALUES (?, ?, ?, ?, ?)",
    [nome, preco, marca, tipo, imagem],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// ✏️ EDITAR
app.put("/produtos/:id", auth, upload.single("imagem"), (req, res) => {
  const { id } = req.params;
  const { nome, preco, marca, tipo } = req.body;

  const imagem = req.file ? "/uploads/" + req.file.filename : null;

  let sql, params;

  if (imagem) {
    sql = `
      UPDATE produtos 
      SET nome=?, preco=?, marca=?, tipo=?, imagem=? 
      WHERE id=?
    `;
    params = [nome, preco, marca, tipo, imagem, id];
  } else {
    sql = `
      UPDATE produtos 
      SET nome=?, preco=?, marca=?, tipo=? 
      WHERE id=?
    `;
    params = [nome, preco, marca, tipo, id];
  }

  db.run(sql, params, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// 🗑️ DELETE
app.delete("/produtos/:id", auth, (req, res) => {
  db.run("DELETE FROM produtos WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// 💰 vendas (para futuro gráfico real)
app.post("/vendas", (req, res) => {
  const { produto_id, nome, preco } = req.body;

  db.run(
    "INSERT INTO vendas (produto_id, nome, preco) VALUES (?, ?, ?)",
    [produto_id, nome, preco],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

// 📊 pegar vendas (GRÁFICO REAL)
app.get("/vendas", (req, res) => {
  db.all("SELECT * FROM vendas", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 🚀 server
app.listen(3000, () => {
  console.log("🔥 Servidor rodando em http://localhost:3000");
});