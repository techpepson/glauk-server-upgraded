-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "verificationCode" TEXT,
    "userName" TEXT,
    "isEmailVerified" BOOLEAN DEFAULT false,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "level" INTEGER DEFAULT 1,
    "phone" TEXT NOT NULL,
    "xp" INTEGER DEFAULT 0,
    "totalXp" INTEGER DEFAULT 100,
    "targetGpa" DOUBLE PRECISION DEFAULT 4.0,
    "major" TEXT,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profileImage" TEXT,
    "isFirstTimeUser" BOOLEAN NOT NULL DEFAULT true,
    "isUserRemembered" BOOLEAN NOT NULL DEFAULT false,
    "preferEmailNotification" BOOLEAN NOT NULL DEFAULT true,
    "preferPushNotification" BOOLEAN NOT NULL DEFAULT true,
    "preferQuizReminders" BOOLEAN NOT NULL DEFAULT true,
    "preferLeaderboardUpdates" BOOLEAN NOT NULL DEFAULT true,
    "currentGpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCredits" INTEGER NOT NULL DEFAULT 30,
    "role" TEXT NOT NULL DEFAULT 'student',
    "verifiedAt" TIMESTAMP(3),
    "verificationCodeSentAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courses" (
    "id" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "courseDescription" TEXT,
    "courseCode" TEXT NOT NULL,
    "courseCredits" INTEGER NOT NULL,
    "courseGrades" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "courseGradePoints" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "courseInstructorEmail" TEXT,
    "courseScores" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSlides" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "slideUrl" TEXT NOT NULL,
    "courseArea" TEXT NOT NULL,
    "completionStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSlides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "content" JSONB,
    "correctAnswers" INTEGER NOT NULL,
    "remarks" TEXT,
    "difficultyLevel" TEXT NOT NULL DEFAULT 'medium',
    "questionType" TEXT NOT NULL DEFAULT 'multiple_choice',
    "numberOfQuestionsGenerated" INTEGER NOT NULL,
    "obtainedGrade" TEXT NOT NULL DEFAULT 'X',
    "obtainedGPT" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseSlidesId" TEXT NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Courses_courseCode_userId_key" ON "Courses"("courseCode", "userId");

-- AddForeignKey
ALTER TABLE "Courses" ADD CONSTRAINT "Courses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSlides" ADD CONSTRAINT "CourseSlides_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_courseSlidesId_fkey" FOREIGN KEY ("courseSlidesId") REFERENCES "CourseSlides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
