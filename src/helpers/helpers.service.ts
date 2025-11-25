import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import ShortUniqueId from 'short-unique-id';
import { supabase } from '../supabase/supabase-client';
import { PDFParse } from 'pdf-parse';
import PpptxToJson from 'pptx2json';
// import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
// import { QuestionType, QuizDifficulty } from '../enum/enum';
import pLimit from 'p-limit';

@Injectable()
export class HelpersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  logger = new Logger(HelpersService.name);

  bucketName = 'Glauk';

  //async helper method to check if a user exists
  async userExist(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    //send an error if user does not exist
    if (user) {
      return {
        user,
        exists: true,
      };
    } else {
      return {
        user: null,
        exists: false,
      };
    }
  }

  async userEmailVerified(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    //send an error if user does not exist
    if (user?.isEmailVerified === true) {
      return true;
    } else {
      return false;
    }
  }

  async generateRandomCode(length: number) {
    const uid = new ShortUniqueId({ length: length, dictionary: 'hex' });
    return uid.rnd();
  }

  async parseFileToSupabase(file: Express.Multer.File, email?: string) {
    try {
      const fileBuffer = file.buffer;

      if (!fileBuffer.buffer) {
        throw new BadRequestException('File buffer is empty');
      }

      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      const userName = user?.name;
      const randomCode = await this.generateRandomCode(5);

      const ext = file.originalname.split('.').pop()?.trim().toLowerCase();
      const fileName = `${userName}-${randomCode}.${ext}`;
      const pdfFilePath = `glauk-pdfs/${fileName}`;
      const pptxFilePath = `glauk-pptx/${fileName}`;

      if (ext == 'pdf') {
        const { data, error } = await supabase.storage
          .from(this.bucketName)
          .upload(pdfFilePath, fileBuffer);

        if (error) {
          throw new BadRequestException('There was an error uploading pdf.');
        }

        const { data: publicData } = supabase.storage
          .from(this.bucketName)
          .getPublicUrl(pdfFilePath);

        return {
          publicUrl: publicData.publicUrl,
          path: data.path,
        };
      } else if (ext == 'pptx') {
        const { data, error } = await supabase.storage
          .from(this.bucketName)
          .upload(pptxFilePath, fileBuffer);

        if (error) {
          throw new BadRequestException('There was an error uploading pdf.');
        }

        const { data: publicdData } = supabase.storage
          .from(this.bucketName)
          .getPublicUrl(pptxFilePath);

        return {
          publicUrl: publicdData.publicUrl,
          path: data.path,
        };
      } else {
        throw new BadRequestException('Unsupported file format');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException(error.message);
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async parseFileToText(file: Express.Multer.File, email?: string) {
    try {
      const fileBuffer = file.buffer;

      let textContent = '';

      //check if file buffer exists
      if (!fileBuffer) {
        throw new BadRequestException('File buffer is empty');
      }

      //file extension
      const { path, originalname } = file;

      const ext = originalname.split('.').pop()?.trim().toLowerCase();

      if (ext == 'pdf') {
        const uploadPdf = await this.parseFileToSupabase(file, email);

        const pdfUrl = uploadPdf.publicUrl;

        const pdfParse = new PDFParse({ url: pdfUrl });

        const pdfText = await pdfParse.getText();

        const chunkText = await this.chunkText(pdfText.text);

        return {
          text: pdfText,
          pdfInfo: await pdfParse.getInfo(),
          chunkText: chunkText.chunks,
        };
      } else if (ext == 'pptx') {
        const uploadPptx = await this.parseFileToSupabase(file, email);
        const pptxUrl = uploadPptx.publicUrl;
        const pptxParse = new PpptxToJson();
        const json = await pptxParse.toJson(pptxUrl);

        let output = '';

        for (const slide of json.slides ?? []) {
          for (const t of slide.texts ?? []) {
            if (t.text) {
              output += t.text + '\n';
            }
          }
        }

        const chunkText = await this.chunkText(output);
        return {
          text: output,
          pptxInfo: json,
          chunkText: chunkText.chunks,
        };
      } else {
        throw new BadRequestException('Unsupported file format');
      }
    } catch (error) {
      console.log(error);
      if (error instanceof BadRequestException) {
        throw new BadRequestException(error.message);
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async chunkText(text: string, chunkSize = 10000) {
    try {
      const chunks: string[] = [];

      let currentChunk: string = '';

      const sentences = text.split(/(?<=[.?!])\s+/);

      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > chunkSize) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += ` ${sentence}`;
        }
      }

      if (currentChunk) chunks.push(currentChunk.trim());
      this.logger.log(`Text chunked into ${chunks.length} chunks.`);
      this.logger.log(`First chunk preview: ${chunks[0]?.slice(0, 100)}...`);
      return { chunks };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error.message);
    }
  }

  async callModelWithRetry(body, apiKey, retries = 5) {
    const BASE_BACKOFF = 1200; // base delay
    const JITTER = 400; // add random jitter to avoid burst patterns

    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      // SUCCESS
      if (response.ok) return response;

      // RATE-LIMITED (429)
      if (response.status === 429) {
        // Read OpenRouter limit headers if available
        const reset = response.headers.get('x-ratelimit-reset');
        let wait = BASE_BACKOFF * attempt + Math.floor(Math.random() * JITTER);

        // If server gives a reset time, respect it
        if (reset) {
          const resetMs = Number(reset) * 1000;
          if (!isNaN(resetMs)) {
            wait = Math.max(wait, resetMs);
          }
        }

        console.log(`RATE LIMITED (429). Retry #${attempt} in ${wait}ms...`);
        await new Promise((res) => setTimeout(res, wait));

        if (attempt === retries) {
          throw new InternalServerErrorException(
            `Max retries reached (429 | rate limited)`,
          );
        }

        continue;
      }

      // SERVER ERRORS (500+)
      if (response.status >= 500) {
        const wait =
          BASE_BACKOFF * attempt + Math.floor(Math.random() * JITTER);
        console.log(
          `SERVER ERROR ${response.status}. Retrying in ${wait}ms...`,
        );
        await new Promise((res) => setTimeout(res, wait));
        continue;
      }

      // OTHER ERRORS
      throw new Error(`Model call failed: ${await response.text()}`);
    }

    throw new Error('Model failed after maximum retries.');
  }

  safeFetch = async (fn) => {
    // Force a pause between ANY requests
    await new Promise((r) => setTimeout(r, 1500)); // safer delay for free models
    return fn();
  };

  async makeRequestToAIModel(
    numberOfQuestions: number,
    questionTypeConfig: string,
    chunkText: string[],
    additionalNotes?: string,
    difficultyLevel?: string,
  ) {
    const apiKey = this.configService.get<string>('openRouter.apiKey');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'OpenRouter API key is not configured',
      );
    }

    const limit = pLimit(1); // STRICT sequential (best for free tier)
    const model = this.configService.get<string>('openRouter.model');

    const MAX_RETRIES = 5;
    const PAUSE_BETWEEN_REQUESTS_MS = 2500; // safer pacing
    const chunkSummaries: string[] = [];

    // ---- SUMMARIZE CHUNK ----
    const summarizeChunk = async (chunk: string, index: number) => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const prompt = `
Summarize the following text chunk into key points and concepts.
Return ONLY the summary text. No JSON or extra notes.

CHUNK ${index + 1}:
${chunk}
        `;

          const response = await fetch(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
              }),
            },
          );

          // RATE LIMITED
          if (response.status === 429) {
            const wait =
              PAUSE_BETWEEN_REQUESTS_MS * attempt +
              Math.floor(Math.random() * 500);

            await new Promise((r) => setTimeout(r, wait));

            if (attempt === MAX_RETRIES) {
              throw new InternalServerErrorException(
                'Max retries reached for chunk summarization (429)',
              );
            }

            continue;
          }

          // SERVER ERROR
          if (response.status >= 500) {
            const wait =
              PAUSE_BETWEEN_REQUESTS_MS * attempt +
              Math.floor(Math.random() * 500);
            console.log(
              `Chunk ${index + 1} server error ${response.status}. Retrying in ${wait}ms...`,
            );
            await new Promise((r) => setTimeout(r, wait));
            continue;
          }

          // OTHER ERRORS
          if (!response.ok) {
            const text = await response.text();
            throw new Error(`Chunk ${index + 1} failed: ${text}`);
          }

          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content?.trim();

          if (!content) {
            throw new Error(`Chunk ${index + 1} returned empty content`);
          }

          return content;
        } catch (err) {
          if (attempt === MAX_RETRIES) throw err;

          const wait =
            PAUSE_BETWEEN_REQUESTS_MS * attempt +
            Math.floor(Math.random() * 500);

          console.log(
            `Chunk ${index + 1} error. Retry ${attempt} in ${wait}ms...`,
          );

          await new Promise((r) => setTimeout(r, wait));
        }
      }
    };

    // ---- STEP 1: Summaries ----
    const batchSummaries = await Promise.all(
      chunkText.map((chunk, i) =>
        limit(() => this.safeFetch(() => summarizeChunk(chunk, i))),
      ),
    );

    chunkSummaries.push(...batchSummaries);

    // Extra pause to avoid hitting limits
    await new Promise((r) => setTimeout(r, 500));

    // ---- STEP 2: Merge summaries ----
    const mergedSummary = chunkSummaries.join('\n\n');

    // ---- STEP 3: Generate quiz ----
    const quizPrompt = `
You are an AI system that analyzes academic content and generates high-quality examinable quizzes in STRICT JSON.

DOCUMENT SUMMARY:
${mergedSummary}

TASK:
1. Write a polished summary.
2. Generate exactly ${numberOfQuestions} questions.
3. Use distribution:
${questionTypeConfig}

Difficulty: ${difficultyLevel ?? 'Not specified'}
Notes: ${additionalNotes ?? 'None'}

Rules:
- Use only information from the summary.
- MCQs must have 4 options.
- Every question must contain:
  "type", "question", "options" (or null),
  "correct_answer", "explanation"

Return ONLY valid JSON.
`;

    const quizResponse = await this.callModelWithRetry(
      {
        model: model,
        messages: [{ role: 'user', content: quizPrompt }],
        temperature: 0.3,
      },
      apiKey,
    );

    if (!quizResponse.ok) {
      const text = await quizResponse.text();
      throw new InternalServerErrorException(`Quiz generation failed: ${text}`);
    }

    const resultData = await quizResponse.json();
    const quizJson = resultData?.choices?.[0]?.message?.content;

    if (!quizJson) {
      throw new InternalServerErrorException(
        'AI did not return valid JSON for quiz',
      );
    }

    return quizJson;
  }
}
