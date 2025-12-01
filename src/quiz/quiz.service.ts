import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HelpersService } from '../helpers/helpers.service';
import { QuizDto, QuizResponseDto } from '../dto/quiz.dto';
import { COMPLETIONSTATUS } from '../enum/enum';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QuizService {
  logger = new Logger(QuizService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: HelpersService,
    @InjectQueue('quiz-processing') private readonly quizProcessingQueue: Queue,
  ) {}

  async addQuizProcessToQueue(
    payload: QuizDto,
    email: string,
    file: Express.Multer.File,
    courseId: string,
  ) {
    try {
      const user = (await this.helpers.userExist(email)).user;
      if (!user) throw new NotFoundException('User does not exist');

      const requiredCredits = Math.ceil(payload.numberOfQuestions / 10);
      const hasEnoughCredits = await this.helpers.checkUserCredit(
        email,
        requiredCredits,
      );
      if (!hasEnoughCredits) {
        throw new PreconditionFailedException('Not enough credits');
      }

      if (!file?.buffer || file.buffer.length === 0) {
        throw new BadRequestException('Invalid file');
      }

      // STEP 1: Extract text
      const extracted = await this.helpers.extractFileContent(file, email);

      // STEP 2: FORCE rawText to be a clean string
      let extractedText: string;

      if (typeof extracted.rawText === 'string') {
        extractedText = extracted.rawText;
      } else if (Buffer.isBuffer(extracted.rawText)) {
        extractedText = extracted.rawText;
      } else if (extracted.rawText && typeof extracted.rawText === 'object') {
        extractedText = JSON.stringify(extracted.rawText);
      } else {
        extractedText = String(extracted.rawText ?? '');
      }

      // Remove null bytes and trim
      extractedText = extractedText.replace(/\0/g, '').trim();

      if (extractedText.length === 0) {
        throw new BadRequestException('No readable text found in the file');
      }

      const chunks = await this.helpers.chunkText(extractedText);
      // STEP 3: Add to queue — now 100% safe
      const job = await this.quizProcessingQueue.add('process-quiz', {
        email,
        chunks, // ← guaranteed array of text chunks
        url: extracted.url,
        numberOfQuestions: payload.numberOfQuestions,
        questionType: payload.questionType || 'multiple_choice',
        difficultyLevel: payload.difficultyLevel || 'medium',
        courseId,
        additionalNotes: payload.additionalNotes || '',
        courseArea: payload.courseArea,
      });

      return {
        jobId: job.id,
        status: 'queued',
        message: 'Quiz generation started in background',
        sourceUrl: extracted.url,
      };
    } catch (error) {
      this.logger.error('Failed to queue quiz', error);
      throw error;
    }
  }
  async getJobStatus(jobId: string, email: string) {
    try {
      const userExists = await this.helpers.userExist(email);
      if (!userExists) {
        throw new NotFoundException('User not found');
      }
      const job = await this.quizProcessingQueue.getJob(jobId);
      if (!job) {
        throw new NotFoundException('Job not found');
      }

      const state = await job.getState();
      const progress = job.progress;
      const result = job.returnvalue;

      return {
        jobId: job.id,
        state,
        progress,
        result,
      };
    } catch (error) {
      this.logger.error('Failed to get job status', error);
      throw error;
    }
  }

  async getAllSlidesForCourse(courseId: string, email: string) {
    try {
      const user = (await this.helpers.userExist(email)).user;

      //check if user exists
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const userSlides = await this.prisma.user.findUnique({
        where: { email: email },
        select: {
          courses: {
            select: {
              user: false,
            },
          },
        },
      });

      return userSlides;
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else {
        throw new InternalServerErrorException(
          'Failed to retrieve slides for the course',
        );
      }
    }
  }

  async submitCompletedQuiz(
    email: string,
    slideId: string,
    payload: QuizResponseDto,
    questionId: string,
    courseId: string,
    score: number,
  ) {
    try {
      const user = (await this.helpers.userExist(email)).user;

      //check if user exists
      if (!user) {
        throw new NotFoundException('User not found');
      }

      //check if slide exists
      const slide = await this.prisma.courseSlides.findUnique({
        where: { id: slideId },
        include: { questions: true },
      });

      if (!slide) {
        throw new NotFoundException('No slide found with the provided ID');
      }

      const updatedCourses = await this.prisma.courses.update({
        where: { id: courseId },
        data: {
          courseGrades: {
            push: payload.grade,
          },
          courseGradePoints: {
            push: payload.gradePoint,
          },
          courseScores: {
            push: score,
          },
        },
      });

      //calculate average for gradepoint
      const updatedGradePoints: number[] = updatedCourses.courseGradePoints;

      const sumOfGradePoints = updatedGradePoints.reduce(
        (previous, current) => previous + current,
        0.0,
      );

      const gradePointAverage = sumOfGradePoints / updatedGradePoints.length;

      const courseCredits = updatedCourses.courseCredits;

      const userGpa = gradePointAverage / courseCredits;

      const averageScore =
        updatedCourses.courseScores.reduce(
          (previous, current) => previous + current,
          0.0,
        ) / updatedCourses.courseScores.length;

      //update the slide details
      await this.prisma.question.update({
        where: {
          id: questionId,
        },
        data: {
          correctAnswer: '',
          remarks: payload.remarks,
          obtainedGrade: payload.grade,
          obtainedGPT: payload.gradePoint,
        },
      });

      //updated user
      await this.prisma.user.update({
        where: {
          email,
        },
        data: {
          currentGpa: userGpa,
        },
      });

      //change completed status of slide
      await this.prisma.courseSlides.update({
        where: {
          id: slideId,
        },
        data: {
          completionStatus: COMPLETIONSTATUS.COMPLETED,
        },
      });

      return {
        message: 'Quiz Graded Successfully',
        currentGpa: userGpa,
        averageScore: averageScore,
        gradePointAverage: gradePointAverage,
        courses: updatedCourses,
      };

      //Process answers and calculate score
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else throw new InternalServerErrorException(error.message);
    }
  }
}
