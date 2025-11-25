/*
https://docs.nestjs.com/providers#services
*/

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HelpersService } from '../helpers/helpers.service';
import { QuizDto, QuizResponseDto } from '../dto/quiz.dto';
import { COMPLETIONSTATUS } from '../enum/enum';

@Injectable()
export class QuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: HelpersService,
  ) {}

  async generateQuizFromPDF(
    file: Express.Multer.File,
    email: string,
    payload: QuizDto,
    courseId?: string,
  ) {
    try {
      const user = (await this.helpers.userExist(email)).user;

      //check if user exists
      if (!user) {
        throw new NotFoundException('User not found');
      }

      //check if course exists
      const course = await this.prisma.courses.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        throw new NotFoundException('No course found with the provided ID');
      }

      //check if user has enough credits
      const userCredits = user.totalCredits;

      //throw an error of user credits are less than number of questions
      if (userCredits < payload.numberOfQuestions) {
        throw new PreconditionFailedException(
          'Your credits are not sufficient to generate this quiz.',
        );
      }

      const parseToText = await this.helpers.parseFileToText(file, email);
      // const pdfUrl = await this.helpers.parseFileToSupabase(file, email);

      const chunkedText = parseToText?.chunkText ?? [];

      //upload slides to AI model to generate quiz
      const aIRequest = await this.helpers.makeRequestToAIModel(
        payload.numberOfQuestions,
        payload.questionType,
        chunkedText,
        payload.additionalNotes,
        payload.difficultyLevel,
      );

      await this.prisma.user.update({
        where: { id: user.id },
        data: { totalCredits: { decrement: payload.numberOfQuestions / 2 } },
      });

      console.log(aIRequest);

      return {
        response: aIRequest,
        // records: quizRecord,
      };
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else if (error instanceof PreconditionFailedException) {
        throw new PreconditionFailedException(error.message);
      } else {
        throw new InternalServerErrorException(error.message);
      }
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
