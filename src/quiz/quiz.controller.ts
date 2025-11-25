/*
https://docs.nestjs.com/controllers#controllers
*/

import {
  Body,
  Controller,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { QuizService } from './quiz.service';
import * as pdfParse from 'pdf-parse';
import * as fs from 'fs';
import { Request } from 'express';
import { QuizDto } from '../dto/quiz.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('generate-quiz')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async generateQuiz(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Body() payload: QuizDto,
    @Query('courseId') courseId?: string,
  ) {
    const user = (req.user as any).email;

    const quizService = await this.quizService.generateQuizFromPDF(
      file,
      user,
      payload,
      courseId,
    );

    return {
      message: 'Quiz generated successfully',
      data: quizService.response,
    };
  }

  async deleteSavedQuiz() {
    // Implementation for deleting a saved quiz will go here
  }
}
