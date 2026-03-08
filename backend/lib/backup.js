import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// .env dosyasını backup.js'in bulunduğu dizine göre çöz (Render'da cwd farklı olabilir)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");
dotenv.config({ path: envPath });

/**
 * DATABASE_URL'den bağlantı bilgilerini çıkar.
 * Format: mysql://user:password@host:port/database
 */
function parseDbUrl(url) {
    try {
        const u = new URL(url);
        return {
            host: u.hostname,
            port: Number(u.port) || 3306,
            user: decodeURIComponent(u.username),
            password: decodeURIComponent(u.password),
            database: u.pathname.replace(/^\//, ""),
        };
    } catch {
        return null;
    }
}

function getDbConfig() {
    // DATABASE_URL öncelikli (Prisma kullanıyor ve çalışıyor)
    const fromUrl = process.env.DATABASE_URL ? parseDbUrl(process.env.DATABASE_URL) : null;
    if (fromUrl?.host && fromUrl?.database) {
        console.log("[BACKUP] Config: DATABASE_URL kullanılıyor");
        return fromUrl;
    }
    // Fallback: bireysel env var'lar
    console.log("[BACKUP] Config: bireysel DB_* env var'ları kullanılıyor");
    return {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME,
    };
}

/**
 * Saf Node.js ile MySQL dump oluşturur (mysqldump binary'e ihtiyaç DUYMAZ).
 * Render gibi binary erişimi olmayan ortamlarda sorunsuz çalışır.
 */
async function generateSqlDump() {
    const cfg = getDbConfig();
    if (!cfg.database) throw new Error("Veritabanı adı bulunamadı (DB_NAME veya DATABASE_URL ayarlayın).");

    console.log(`[BACKUP] DB bağlantısı: ${cfg.host}:${cfg.port}/${cfg.database} (user: ${cfg.user})`);

    const connection = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        connectTimeout: 30000,
    });

    const lines = [];
    const dbName = cfg.database;

    lines.push(`-- TuraÇevre SQL Dump`);
    lines.push(`-- Tarih: ${new Date().toISOString()}`);
    lines.push(`-- Veritabanı: ${dbName}`);
    lines.push(`SET NAMES utf8mb4;`);
    lines.push(`SET FOREIGN_KEY_CHECKS = 0;\n`);

    // Tüm tabloları listele
    const [tables] = await connection.query("SHOW TABLES");
    const tableKey = `Tables_in_${dbName}`;

    for (const row of tables) {
        const tableName = row[tableKey] || Object.values(row)[0];

        // CREATE TABLE
        const [createResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
        const createSql = createResult[0]["Create Table"];
        lines.push(`-- ---`);
        lines.push(`-- Tablo: ${tableName}`);
        lines.push(`-- ---`);
        lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
        lines.push(`${createSql};\n`);

        // INSERT DATA
        const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
        if (rows.length > 0) {
            // Batch insert (1000 satır grupla)
            const batchSize = 1000;
            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                const columns = Object.keys(batch[0]).map(c => `\`${c}\``).join(", ");
                const values = batch.map(r => {
                    const vals = Object.values(r).map(v => {
                        if (v === null) return "NULL";
                        if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
                        if (typeof v === "number") return String(v);
                        if (Buffer.isBuffer(v)) return `X'${v.toString("hex")}'`;
                        if (typeof v === "object") return connection.escape(JSON.stringify(v));
                        return connection.escape(String(v));
                    });
                    return `(${vals.join(", ")})`;
                }).join(",\n  ");
                lines.push(`INSERT INTO \`${tableName}\` (${columns}) VALUES\n  ${values};\n`);
            }
        }
    }

    lines.push(`SET FOREIGN_KEY_CHECKS = 1;\n`);

    await connection.end();
    return lines.join("\n");
}

/**
 * Creates a backup of the database and the uploads folder.
 * @param {Object} options
 * @param {import('express').Response} [options.res] - Express response object for streaming
 * @returns {Promise<void>}
 */
export async function createBackup({ res } = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sqlFilename = `db_dump_${timestamp}.sql`;
    const zipFilename = `backup_${timestamp}.zip`;
    const sqlPath = path.join(process.cwd(), sqlFilename);
    const uploadsDir = path.join(process.cwd(), "uploads");

    try {
        // 1. SQL dump oluştur (saf Node.js, mysqldump gerekmez)
        console.log("[BACKUP] SQL dump oluşturuluyor...");
        const sqlContent = await generateSqlDump();
        fs.writeFileSync(sqlPath, sqlContent, "utf8");
        console.log("[BACKUP] SQL dump tamamlandı:", sqlFilename);

        // 2. ZIP arşivi oluştur
        return await new Promise((resolve, reject) => {
            const archive = archiver("zip", { zlib: { level: 9 } });

            let outputStream;
            if (res) {
                res.attachment(zipFilename);
                outputStream = res;
            } else {
                if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
                return reject(new Error("Express response object (res) is required for streaming bypass"));
            }

            archive.pipe(outputStream);

            // SQL dosyasını ekle
            archive.file(sqlPath, { name: sqlFilename });

            // uploads klasörünü ekle
            if (fs.existsSync(uploadsDir)) {
                archive.directory(uploadsDir, "uploads");
            }

            outputStream.on("close", () => {
                if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
                console.log("[BACKUP] ZIP arşivi tamamlandı:", zipFilename);
                resolve();
            });

            // "finish" event for Express response streams (writable streams that don't emit "close")
            outputStream.on("finish", () => {
                if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
                resolve();
            });

            outputStream.on("error", (err) => {
                if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
                reject(err);
            });

            archive.on("error", (err) => {
                if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
                reject(err);
            });

            archive.finalize();
        });
    } catch (err) {
        if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
        throw err;
    }
}


