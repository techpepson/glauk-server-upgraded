import { HelpersService } from '../helpers/helpers.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [QuizController],
  providers: [QuizService, PrismaService, HelpersService],
})
export class QuizModule {}
