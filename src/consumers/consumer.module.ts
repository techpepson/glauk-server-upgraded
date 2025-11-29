/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { QuizProcessor } from './quiz.processor';
import { HelpersService } from '../helpers/helpers.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [],
  controllers: [],
  providers: [QuizProcessor, HelpersService, ConfigService, PrismaService],
})
export class ConsumerModule {}
