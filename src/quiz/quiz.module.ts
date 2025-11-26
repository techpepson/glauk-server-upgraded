import { BullModule } from '@nestjs/bullmq';
import { HelpersService } from '../helpers/helpers.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'quiz-processing',
      },
      {
        name: 'generate-quiz',
      },
    ),
  ],
  controllers: [QuizController],
  providers: [QuizService, PrismaService, HelpersService],
})
export class QuizModule {}
