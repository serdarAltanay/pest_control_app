-- CreateTable
CREATE TABLE `AccessOwner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `role` ENUM('CALISAN', 'MAGAZA_SORUMLUSU', 'MAGAZA_MUDURU', 'GENEL_MUDUR', 'PATRON', 'DIGER') NOT NULL DEFAULT 'CALISAN',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `hasAcceptedTerms` BOOLEAN NOT NULL DEFAULT false,
    `lastLoginAt` DATETIME(3) NULL,
    `lastProfileAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccessOwner_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessGrant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ownerId` INTEGER NOT NULL,
    `scopeType` ENUM('STORE', 'CUSTOMER') NOT NULL,
    `customerId` INTEGER NULL,
    `storeId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AccessGrant_ownerId_idx`(`ownerId`),
    INDEX `AccessGrant_scopeType_customerId_storeId_idx`(`scopeType`, `customerId`, `storeId`),
    UNIQUE INDEX `unique_access_grant`(`ownerId`, `scopeType`, `customerId`, `storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Complaint` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ownerId` INTEGER NOT NULL,
    `customerId` INTEGER NOT NULL,
    `storeId` INTEGER NOT NULL,
    `type` ENUM('PERSONEL', 'UYGULAMA', 'ISTASYONLAR', 'DIGER') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `employeeName` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `adminSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Complaint_ownerId_idx`(`ownerId`),
    INDEX `Complaint_storeId_createdAt_idx`(`storeId`, `createdAt`),
    INDEX `Complaint_adminSeenAt_idx`(`adminSeenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Suggestion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ownerId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Suggestion_ownerId_createdAt_idx`(`ownerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('COMPLAINT_NEW', 'SUGGESTION_NEW', 'COMPLAINT_SEEN', 'EK1_SUBMITTED', 'VISIT_PLANNED', 'VISIT_ASSIGNED') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NULL,
    `link` VARCHAR(191) NULL,
    `recipientRole` ENUM('ADMIN', 'CUSTOMER', 'EMPLOYEE') NOT NULL,
    `recipientId` INTEGER NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_recipientRole_isRead_createdAt_idx`(`recipientRole`, `isRead`, `createdAt`),
    INDEX `Notification_recipientRole_recipientId_isRead_idx`(`recipientRole`, `recipientId`, `isRead`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StationActivation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeId` INTEGER NOT NULL,
    `stationId` INTEGER NOT NULL,
    `visitId` INTEGER NULL,
    `type` ENUM('FARE_YEMLEME', 'CANLI_YAKALAMA', 'ELEKTRIKLI_SINEK_TUTUCU', 'BOCEK_MONITOR', 'GUVE_TUZAGI') NOT NULL,
    `observedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `aktiviteVar` BOOLEAN NULL,
    `risk` ENUM('RISK_YOK', 'DUSUK', 'ORTA', 'YUKSEK') NOT NULL DEFAULT 'RISK_YOK',
    `notes` VARCHAR(191) NULL,
    `deformeYem` BOOLEAN NULL,
    `yemDegisti` BOOLEAN NULL,
    `deformeMonitor` BOOLEAN NULL,
    `monitorDegisti` BOOLEAN NULL,
    `ulasilamayanMonitor` BOOLEAN NULL,
    `yapiskanDegisti` BOOLEAN NULL,
    `sariBantDegisim` BOOLEAN NULL,
    `arizaliEFK` BOOLEAN NULL,
    `tamirdeEFK` BOOLEAN NULL,
    `uvLambaDegisim` BOOLEAN NULL,
    `uvLambaAriza` BOOLEAN NULL,
    `karasinek` INTEGER NULL DEFAULT 0,
    `sivrisinek` INTEGER NULL DEFAULT 0,
    `diger` INTEGER NULL DEFAULT 0,
    `feromonDegisti` BOOLEAN NULL,
    `deformeTuzak` BOOLEAN NULL,
    `tuzakDegisti` BOOLEAN NULL,
    `ulasilamayanTuzak` BOOLEAN NULL,
    `guve` INTEGER NULL DEFAULT 0,
    `hedefZararliSayisi` INTEGER NULL DEFAULT 0,
    `data` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StationActivation_stationId_observedAt_idx`(`stationId`, `observedAt`),
    INDEX `StationActivation_storeId_observedAt_idx`(`storeId`, `observedAt`),
    INDEX `StationActivation_storeId_type_observedAt_idx`(`storeId`, `type`, `observedAt`),
    INDEX `StationActivation_storeId_risk_observedAt_idx`(`storeId`, `risk`, `observedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProviderProfile` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `companyName` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `responsibleTitle` VARCHAR(191) NULL,
    `responsibleName` VARCHAR(191) NULL,
    `phoneFax` VARCHAR(191) NULL,
    `certificateSerial` VARCHAR(191) NULL,
    `permissionNo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Biocide` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `activeIngredient` VARCHAR(191) NOT NULL,
    `antidote` VARCHAR(191) NOT NULL,
    `unit` ENUM('ML', 'GR', 'LT', 'KG', 'ADET') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Biocide_name_activeIngredient_key`(`name`, `activeIngredient`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Admin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `profileImage` VARCHAR(191) NULL,
    `hasAcceptedTerms` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `lastProfileAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NULL,

    UNIQUE INDEX `Admin_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `jobTitle` VARCHAR(191) NOT NULL,
    `gsm` VARCHAR(191) NOT NULL,
    `profileImage` VARCHAR(191) NULL,
    `hasAcceptedTerms` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `lastProfileAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `adminId` INTEGER NULL,

    UNIQUE INDEX `Employee_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `accountingTitle` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `contactFullName` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `gsm` VARCHAR(191) NULL,
    `taxOffice` VARCHAR(191) NULL,
    `taxNumber` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `showBalance` BOOLEAN NOT NULL DEFAULT false,
    `visitPeriod` ENUM('HAFTALIK', 'IKIHAFTALIK', 'AYLIK', 'IKIAYLIK', 'UCAYLIK', 'BELIRTILMEDI') NOT NULL DEFAULT 'BELIRTILMEDI',
    `profileImage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `employeeId` INTEGER NULL,

    UNIQUE INDEX `Customer_code_key`(`code`),
    UNIQUE INDEX `Customer_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Store` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `manager` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `pestType` ENUM('KEMIRGEN', 'HACCADI', 'UCAN', 'BELIRTILMEDI') NOT NULL DEFAULT 'BELIRTILMEDI',
    `placeType` ENUM('OFIS', 'DEPO', 'MAGAZA', 'FABRIKA', 'BELIRTILMEDI') NOT NULL DEFAULT 'BELIRTILMEDI',
    `areaM2` DOUBLE NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `store_customer_code_unique`(`customerId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Station` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeId` INTEGER NOT NULL,
    `type` ENUM('FARE_YEMLEME', 'CANLI_YAKALAMA', 'ELEKTRIKLI_SINEK_TUTUCU', 'BOCEK_MONITOR', 'GUVE_TUZAGI') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Station_storeId_code_key`(`storeId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `file` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Report_storeId_uploadedAt_idx`(`storeId`, `uploadedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Nonconformity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `observedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `createdById` INTEGER NULL,
    `createdByRole` VARCHAR(191) NULL,
    `createdByName` VARCHAR(191) NULL,

    INDEX `Nonconformity_storeId_idx`(`storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Visit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storeId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `startTime` VARCHAR(191) NULL,
    `endTime` VARCHAR(191) NULL,
    `visitType` ENUM('PERIYODIK', 'ACIL_CAGRI', 'ISTASYON_KURULUM', 'ILK_ZIYARET', 'DIGER') NOT NULL,
    `targetPests` JSON NULL,
    `notes` VARCHAR(191) NULL,
    `employees` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ek1Report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitId` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED') NOT NULL DEFAULT 'DRAFT',
    `pdfUrl` VARCHAR(191) NULL,
    `providerSignedAt` DATETIME(3) NULL,
    `providerSignerName` VARCHAR(191) NULL,
    `providerSignature` LONGTEXT NULL,
    `providerSignLog` JSON NULL,
    `customerSignedAt` DATETIME(3) NULL,
    `customerSignerName` VARCHAR(191) NULL,
    `customerSignature` LONGTEXT NULL,
    `customerSignLog` JSON NULL,
    `mailSentAt` DATETIME(3) NULL,
    `mailRecipient` VARCHAR(191) NULL,
    `freeMeta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Ek1Report_visitId_key`(`visitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ek1Line` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitId` INTEGER NOT NULL,
    `biosidalId` INTEGER NOT NULL,
    `method` ENUM('ULV', 'PUSKURTME', 'JEL', 'SISLEME', 'YENILEME', 'ATOMIZER', 'YEMLEME', 'PULVERİZE') NOT NULL,
    `amount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `employeeId` INTEGER NOT NULL,
    `storeId` INTEGER NOT NULL,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `plannedById` INTEGER NULL,
    `plannedByRole` ENUM('admin', 'employee') NULL,
    `plannedByName` VARCHAR(191) NULL,
    `plannedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('PENDING', 'PLANNED', 'COMPLETED', 'FAILED', 'CANCELLED', 'POSTPONED') NOT NULL DEFAULT 'PLANNED',

    INDEX `ScheduleEvent_start_idx`(`start`),
    INDEX `ScheduleEvent_employeeId_idx`(`employeeId`),
    INDEX `ScheduleEvent_storeId_idx`(`storeId`),
    INDEX `ScheduleEvent_plannedById_idx`(`plannedById`),
    INDEX `ScheduleEvent_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeTrackPoint` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `lat` DECIMAL(10, 7) NOT NULL,
    `lng` DECIMAL(10, 7) NOT NULL,
    `accuracy` INTEGER NULL,
    `speed` DOUBLE NULL,
    `heading` DOUBLE NULL,
    `source` VARCHAR(191) NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmployeeTrackPoint_employeeId_at_idx`(`employeeId`, `at`),
    INDEX `EmployeeTrackPoint_at_idx`(`at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(500) NOT NULL,
    `userId` INTEGER NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RefreshToken_token_key`(`token`),
    UNIQUE INDEX `RefreshToken_userId_role_key`(`userId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyCertificate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `file` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CompanyCertificate_uploadedAt_idx`(`uploadedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsentLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `userRole` VARCHAR(191) NOT NULL,
    `consentType` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConsentLog_userId_userRole_idx`(`userId`, `userRole`),
    INDEX `ConsentLog_consentType_idx`(`consentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AccessGrant` ADD CONSTRAINT `AccessGrant_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `AccessOwner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessGrant` ADD CONSTRAINT `AccessGrant_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessGrant` ADD CONSTRAINT `AccessGrant_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Complaint` ADD CONSTRAINT `Complaint_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `AccessOwner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Complaint` ADD CONSTRAINT `Complaint_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Complaint` ADD CONSTRAINT `Complaint_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Suggestion` ADD CONSTRAINT `Suggestion_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `AccessOwner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StationActivation` ADD CONSTRAINT `StationActivation_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StationActivation` ADD CONSTRAINT `StationActivation_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `Station`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StationActivation` ADD CONSTRAINT `StationActivation_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Admin`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Store` ADD CONSTRAINT `Store_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Station` ADD CONSTRAINT `Station_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Nonconformity` ADD CONSTRAINT `Nonconformity_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Visit` ADD CONSTRAINT `Visit_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ek1Report` ADD CONSTRAINT `Ek1Report_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ek1Line` ADD CONSTRAINT `Ek1Line_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `Visit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ek1Line` ADD CONSTRAINT `Ek1Line_biosidalId_fkey` FOREIGN KEY (`biosidalId`) REFERENCES `Biocide`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleEvent` ADD CONSTRAINT `ScheduleEvent_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleEvent` ADD CONSTRAINT `ScheduleEvent_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeTrackPoint` ADD CONSTRAINT `EmployeeTrackPoint_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
