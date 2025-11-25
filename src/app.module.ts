import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
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
