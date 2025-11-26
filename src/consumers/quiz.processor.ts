/*
https://docs.nestjs.com/providers#services
*/

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { HelpersService } from '../helpers/helpers.service';
import { Job } from 'bullmq';
import { QuizDto } from '../dto/quiz.dto';

@Processor('quiz')
export class QuizProcessor extends WorkerHost {
  constructor(private readonly helpers: HelpersService) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case 'process-quiz': {
        const { payload, email, file } = job.data;

        //extract the content of the pdf file
        const extractedContent = await this.helpers.extractFileContent(
          file,
          email,
        );

        const rawText = extractedContent.rawText;

        const fileUrl = extractedContent.url;

        //additional processing logic will go here
      }
    }
  }
}
