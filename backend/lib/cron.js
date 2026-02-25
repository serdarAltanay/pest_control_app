import cron from "node-cron";
import { createBackup, cleanupOldBackups } from "./backup.js";

/**
 * Initializes all system cron jobs.
 */
export function initCronJobs() {
    console.log("Initializing Cron Jobs...");

    // Nightly Backup at 03:00 AM
    cron.schedule("0 3 * * *", async () => {
        console.log("Running nightly automated backup...");
        try {
            await createBackup({ saveToDisk: true });
            console.log("Nightly backup completed successfully.");

            console.log("Running backup cleanup...");
            await cleanupOldBackups();
            console.log("Backup cleanup completed.");
        } catch (error) {
            console.error("Nightly backup/cleanup failed:", error);
        }
    });

    console.log("Cron jobs scheduled: Nightly Backup (03:00)");
}
