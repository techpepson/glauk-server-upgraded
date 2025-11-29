import { ConsumerModule } from './consumers/consumer.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QuizModule } from './quiz/quiz.module';
import { HelpersModule } from './helpers/helpers.module';
import { CoursesModule } from './courses/courses.module';
import { CoursesController } from './courses/courses.controller';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import config from './config/app.config';
import { CoursesService } from './courses/courses.service';

import { PrismaService } from './prisma/prisma.service';
import { QuizService } from './quiz/quiz.service';
import { AuthService } from './auth/auth.service';
import { HelpersService } from './helpers/helpers.service';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConsumerModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      }),
      inject: [ConfigService],
    }),

    BullModule.registerQueue({
      name: 'quiz-processing', // ← THIS IS THE EXACT NAME
    }),

    MailerModule.forRoot({
      transport: {
        host: process.env.MAILER_HOST,
        port: parseInt(process.env.MAILER_PORT?.toString() || '465'),
        secure: true,
        auth: {
          user: process.env.MAILER_USER,
          pass: process.env.MAILER_PASS,
        },
      },
      defaults: {
        from: `"The Glauk Team" <${process.env.MAILER_DEFAULT_FROM}>`,
      },
      preview: false,
      template: {
        dir: join(__dirname, '..', 'views'),
        adapter: new HandlebarsAdapter(),
      },
    }),
    MulterModule.register({
      storage: memoryStorage(),
    }),
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    AuthModule,
    QuizModule,
    HelpersModule,
    CoursesModule,
    ConsumerModule,
  ],
  controllers: [CoursesController, AppController],
  providers: [
    AppService,
    CoursesService,
    PrismaService,
    QuizService,
    HelpersService,
    AuthService,
  ],
})
export class AppModule {}
