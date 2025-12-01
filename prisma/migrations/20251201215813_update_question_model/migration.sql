/*
  Warnings:

  - You are about to drop the column `content` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `correctAnswers` on the `Question` table. All the data in the column will be lost.
  - Added the required column `correctAnswer` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Question" DROP COLUMN "content",
DROP COLUMN "correctAnswers",
ADD COLUMN     "correctAnswer" TEXT NOT NULL,
ADD COLUMN     "options" TEXT[],
ADD COLUMN     "question" TEXT NOT NULL,
ADD COLUMN     "reasonForAnswer" TEXT;
