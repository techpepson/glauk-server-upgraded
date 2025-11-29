import {
  Body,
  Controller,
  Get,
  Post,
  Query,
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

  @Post('add-quiz-process')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('pdf'))
  async addQuizProcessToQueue(
    @UploadedFile() pdf: Express.Multer.File,
    @Body() payload: QuizDto,
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

  @Get('quiz-job-status')
  @UseGuards(JwtAuthGuard)
  async getJobStatus(@Req() req: Request, @Query('jobId') jobId: string) {
    const user = (req.user as any)?.email;

    const stringId = jobId.toString();
    console.log('Fetching job status for ID:', stringId);
    const jobStatus = await this.quizService.getJobStatus(stringId, user);
    return jobStatus;
  }
}
