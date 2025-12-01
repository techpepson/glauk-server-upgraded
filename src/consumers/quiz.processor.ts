import { Processor, WorkerHost } from '@nestjs/bullmq';
import { HelpersService } from '../helpers/helpers.service';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionType, QuizDifficulty } from '../enum/enum';

@Processor('quiz-processing', { lockDuration: 300000 })
export class QuizProcessor extends WorkerHost {
  private readonly logger = new Logger(QuizProcessor.name);

  constructor(
    private readonly helpers: HelpersService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name == 'process-quiz') {
      const {
        email,
        chunks,
        url,
        numberOfQuestions,
        questionType,
        difficultyLevel,
        courseId,
        additionalNotes,
        courseArea,
      } = job.data;

      try {
        this.logger.log(
          `Starting quiz generation for ${email} - ${numberOfQuestions} questions`,
        );

        const { quiz, masterSummary } =
          await this.helpers.makeCallToChunkSummarizer(
            chunks,
            numberOfQuestions,
            questionType,
            difficultyLevel,
            additionalNotes,
          );

        const answerId = await this.helpers.generateRandomCode(6);

        // TODO: Save quiz to DB here
        await Promise.all(
          quiz.map(async (q: any) => {
            await this.prisma.courses.update({
              where: {
                id: courseId,
              },
              data: {
                courseSlides: {
                  create: {
                    slideUrl: url,
                    courseArea: courseArea,
                    questions: {
                      create: {
                        question: q.question ?? '',
                        options: q.options ?? [],
                        correctAnswer: q.answer ?? '',
                        reasonForAnswer: q.explanation ?? '',
                        difficultyLevel:
                          difficultyLevel ?? QuizDifficulty.MEDIUM,
                        questionType:
                          questionType ?? QuestionType.MULTIPLE_CHOICE,
                        answerId: answerId ?? '',
                        numberOfQuestionsGenerated: numberOfQuestions ?? 10,
                      },
                    },
                  },
                },
              },
            });
          }),
        );

        this.logger.log(`Quiz generated successfully for ${email}`);

        return {
          success: true,
          quiz,
          summary: masterSummary,
          sourceUrl: url,
        };
      } catch (error: any) {
        this.logger.error(`Quiz generation failed for ${email}`, error.stack);
        throw error; // ← Marks job as FAILED
      }
    }
  }
}
