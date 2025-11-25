import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configDotenv } from 'dotenv';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';

configDotenv();
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  //MVC
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.enableCors({
    origin: [
      'https://google.com',
      'http://localhost:4000',
      'http://localhost:3000',
      '*',
    ],
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: {
        enableImplicitConversion: true, //this allows nest to automatically convert types
      },
    }),
  );

  //set global prefix
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
