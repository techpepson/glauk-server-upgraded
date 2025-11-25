import { CoursesService } from './courses.service';
import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';

import { PrismaService } from '../prisma/prisma.service';
import { HelpersService } from '../helpers/helpers.service';

@Module({
  imports: [],
  controllers: [CoursesController],
  providers: [CoursesService, CoursesService, PrismaService, HelpersService],
})
export class CoursesModule {}
