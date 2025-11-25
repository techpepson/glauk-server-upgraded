import { Module } from '@nestjs/common';
import { HelpersService } from './helpers.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [],
  controllers: [],
  providers: [HelpersService, HelpersService, PrismaService, ConfigService],
  exports: [],
})
export class HelpersModule {}
