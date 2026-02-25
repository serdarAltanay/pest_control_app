import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import dotenv from "dotenv";

dotenv.config();

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

    return new Promise((resolve, reject) => {
        // 1. Run mysqldump
        const mysqldumpPath = process.env.MYSQLDUMP_PATH || "mysqldump";
        console.log("Using mysqldump path:", mysqldumpPath);

        const dumpProcess = spawn(mysqldumpPath, [
            "-h", process.env.DB_HOST || "localhost",
            "-u", process.env.DB_USER || "root",
            `--password=${process.env.DB_PASSWORD}`,
            process.env.DB_NAME,
        ]);

        // Handle spawn errors (e.g. ENOENT)
        dumpProcess.on("error", (err) => {
            console.error("Failed to start mysqldump process:", err);
            if (err.code === "ENOENT") {
                reject(new Error("mysqldump bulunamadı. Lütfen sistem yoluna ekleyin veya .env içinde MYSQLDUMP_PATH belirtin."));
            } else {
                reject(err);
            }
        });

        const sqlStream = fs.createWriteStream(sqlPath);
        dumpProcess.stdout.pipe(sqlStream);

        let errorOutput = "";
        dumpProcess.stderr.on("data", (data) => {
            errorOutput += data.toString();
        });

        dumpProcess.on("close", (code) => {
            if (code !== 0) {
                console.error("mysqldump failed:", errorOutput);
                if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
                return reject(new Error(`mysqldump failed: ${errorOutput}`));
            }

            // 2. Zip the SQL file and uploads folder
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

            // Add SQL file
            archive.file(sqlPath, { name: sqlFilename });

            // Add uploads folder
            if (fs.existsSync(uploadsDir)) {
                archive.directory(uploadsDir, "uploads");
            }

            outputStream.on("close", () => {
                // Cleanup temp SQL
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
    });
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
            console.log(`Deleting old backup: ${file}`);
            fs.unlinkSync(filePath);
        }
    });
}
