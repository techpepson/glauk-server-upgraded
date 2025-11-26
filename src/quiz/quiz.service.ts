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
  ) {
    try {
      const user = (await this.helpers.userExist(email)).user;

      //check if user exists in the db
      if (!user) {
        throw new NotFoundException('User does not exist');
      }

      //required points for users
      const requiredCredits = payload.numberOfQuestions / 10;

      const hasEnoughCredits = await this.helpers.checkUserCredit(
        email,
        requiredCredits,
      );

      if (!hasEnoughCredits) {
        throw new PreconditionFailedException(
          'Not enough credits to process pdf',
        );
      }

      if (file.buffer === null) {
        throw new BadRequestException('The uploaded media is not valid.');
      }

      //if the user exists, add the user process to the queue
      const job = await this.quizProcessingQueue.add('process-quiz', {
        payload,
        email,
        file,
      });

      return {
        id: job.id,
        process: job.progress,
        token: job.token,
      };
    } catch (error) {
      this.logger.log(error);
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
          correctAnswers: payload.correctAnswers,
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
