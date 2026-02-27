import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import dotenv from "dotenv";

dotenv.config();

/**
 * Saf Node.js ile MySQL dump oluşturur (mysqldump binary'e ihtiyaç DUYMAZ).
 * Render gibi binary erişimi olmayan ortamlarda sorunsuz çalışır.
 */
async function generateSqlDump() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME,
    });

    const lines = [];
    const dbName = process.env.DB_NAME;

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
 * @param {boolean} [options.saveToDisk] - Whether to save the backup to the backups folder
 * @returns {Promise<string|void>} - Returns the filename if saved to disk
 */
export async function createBackup({ res, saveToDisk = false } = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sqlFilename = `db_dump_${timestamp}.sql`;
    const zipFilename = `backup_${timestamp}.zip`;
    const sqlPath = path.join(process.cwd(), sqlFilename);
    const backupsDir = path.join(process.cwd(), "backups");
    const uploadsDir = path.join(process.cwd(), "uploads");

    if (saveToDisk && !fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }

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
            } else if (saveToDisk) {
                outputStream = fs.createWriteStream(path.join(backupsDir, zipFilename));
            } else {
                if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
                return reject(new Error("No destination provided (res or saveToDisk)"));
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
                resolve(saveToDisk ? zipFilename : undefined);
            });

            // "finish" event for Express response streams (writable streams that don't emit "close")
            outputStream.on("finish", () => {
                if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
                resolve(saveToDisk ? zipFilename : undefined);
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

/**
 * Removes backup files older than 7 days from the backups directory.
 */
export async function cleanupOldBackups() {
    const backupsDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupsDir)) return;

    const files = fs.readdirSync(backupsDir);
    const now = Date.now();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

    files.forEach(file => {
        const filePath = path.join(backupsDir, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > sevenDaysInMs && file.endsWith(".zip")) {
            console.log(`[BACKUP] Eski yedek siliniyor: ${file}`);
            fs.unlinkSync(filePath);
        }
    });
}
