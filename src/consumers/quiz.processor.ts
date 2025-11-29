/*
https://docs.nestjs.com/providers#services
*/

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { HelpersService } from '../helpers/helpers.service';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('quiz-processing', { lockDuration: 300000 })
export class QuizProcessor extends WorkerHost {
  private readonly logger = new Logger(QuizProcessor.name);

  constructor(private readonly helpers: HelpersService) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name == 'process-quiz') {
      const { email, chunks, url, numberOfQuestions, questionType } = job.data;

      try {
        this.logger.log(
          `Starting quiz generation for ${email} - ${numberOfQuestions} questions`,
        );

        const { quiz, masterSummary } =
          await this.helpers.makeCallToChunkSummarizer(
            chunks,
            numberOfQuestions,
            questionType,
          );

        // TODO: Save quiz to DB here
        // await this.prisma.quiz.create({ ... })

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
