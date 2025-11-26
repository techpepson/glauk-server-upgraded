import {
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { QuizService } from './quiz.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuizDto } from '../dto/quiz.dto';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @UseGuards(JwtAuthGuard)
  @Post('add-quiz-process')
  @UseInterceptors(FileInterceptor('pdf'))
  async addQuizProcessToQueue(
    @UploadedFile() pdf: Express.Multer.File,
    @Body('payload') payload: QuizDto,
    @Req() req: Request,
  ) {
    const user = (req.user as any).email;
    const job = await this.quizService.addQuizProcessToQueue(
      payload,
      user,
      pdf,
    );

    return job;
  }

  async deleteSavedQuiz() {
    // Implementation for deleting a saved quiz will go here
  }
}
