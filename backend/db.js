require('dotenv').config();
const mysql = require('mysql2');

// Pool oluştur
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Promise uyumlu
const db = pool.promise();

// Bağlantıyı test et
db.getConnection()
  .then((connection) => {
    console.log("MySQL bağlantısı başarılı!");
    connection.release();
  })
  .catch((err) => {
    console.error("DB bağlantı hatası:", err);
  });

module.exports = db;
