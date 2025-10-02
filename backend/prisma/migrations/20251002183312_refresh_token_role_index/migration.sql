/*
  Warnings:

  - A unique constraint covering the columns `[userId,role]` on the table `RefreshToken` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `RefreshToken_userId_key` ON `refreshtoken`;

-- CreateIndex
CREATE UNIQUE INDEX `RefreshToken_userId_role_key` ON `RefreshToken`(`userId`, `role`);
