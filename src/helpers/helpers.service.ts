import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotAcceptableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import ShortUniqueId from 'short-unique-id';
import { supabase } from '../supabase/supabase-client';
import { PDFParse } from 'pdf-parse';
import { parseOfficeAsync } from 'officeparser';

import { ConfigService } from '@nestjs/config';
import { QuizDifficulty } from '../enum/enum';

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

  async checkUserCredit(email: string, requiredCredit: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || (user.totalCredits ?? 0) < requiredCredit) {
      return false;
    } else {
      return true;
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

      if (!file.buffer || file.buffer.length === 0) {
        throw new BadRequestException('File is empty');
      }

      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
        'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
        'application/pptx',
      ];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new NotAcceptableException('File type not allowed');
      }

      if (file.size > 32 * 1024 * 1024) {
        // 32MB limit
        throw new BadRequestException('File too large');
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
          throw new BadRequestException(
            'There was an error uploading pptx file.',
          );
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

  async extractFileContent(file: Express.Multer.File, email: string) {
    let rawText = '';
    let publicUrl = '';

    try {
      const originalname = file.originalname.toLowerCase();
      const ext = originalname.split('.').pop()?.toLowerCase();

      // === File size check ===
      if (file.size > 35 * 1024 * 1024) {
        throw new BadRequestException('File too large (max 35MB)');
      }

      // === MIME type validation ===
      const allowedMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
        'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
        'application/pptx',
      ];

      if (!allowedMimes.includes(file.mimetype)) {
        throw new NotAcceptableException(
          'File type not allowed. Only PDF and PPTX are supported.',
        );
      }

      // === PDF: Keep your exact working logic ===
      if (ext === 'pdf') {
        const parser = new PDFParse({ data: file.buffer });
        const pdfText = await parser.getText();

        const upload = await this.parseFileToSupabase(file, email);
        publicUrl = upload.publicUrl;

        await parser.destroy();

        rawText = pdfText.text.trim();
      }

      // === PPTX: Clean, modern parsing with officeparser ===
      else if (ext === 'pptx' || ext === 'ppt') {
        const pptText = await parseOfficeAsync(file.buffer, {
          newlineDelimiter: '\n\n',
          ignoreNotes: false,
        });

        rawText = pptText
          .replace(/\0/g, '') // remove null bytes
          .replace(/\r\n/g, '\n')
          .trim();

        if (!rawText) {
          throw new BadRequestException(
            'No readable text found in PPTX slides',
          );
        }

        const upload = await this.parseFileToSupabase(file, email);
        publicUrl = upload.publicUrl;
      }

      // === Unsupported extension ===
      else {
        throw new NotAcceptableException('Unsupported file extension');
      }

      // === Final validation ===
      if (!rawText) {
        throw new BadRequestException('File contains no extractable text');
      }

      return {
        rawText,
        url: publicUrl,
      };
    } catch (error) {
      this.logger.error('extractFileContent failed:', error);

      // Let validation errors pass through
      if (
        error instanceof BadRequestException ||
        error instanceof NotAcceptableException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('File parsing failed');
    }
  }

  async chunkText(
    text: string,
    options: {
      maxTokens?: number;
      overlapTokens?: number;
      separator?: string;
    } = {},
  ) {
    const {
      maxTokens = 50000, // safe for Grok, Claude, GPT-4o, etc.
      overlapTokens = 200, // prevents context loss
      separator = '\n\n', // paragraph / slide break
    } = options;

    if (!text.trim()) return [];

    // Rough token estimation: 1 token ≈ 4 chars (good enough for most languages)
    const avgCharsPerToken = 4;
    const maxChars = maxTokens * avgCharsPerToken;
    const overlapChars = overlapTokens * avgCharsPerToken;

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = start + maxChars;

      // If we're near the end, just take the rest
      if (end >= text.length) {
        chunks.push(text.slice(start).trim());
        break;
      }

      // Try to cut at a natural breakpoint (paragraph, list, etc.)
      let cutAt = text.lastIndexOf(separator, end);
      if (cutAt <= start) cutAt = text.lastIndexOf('\n', end);
      if (cutAt <= start) cutAt = text.lastIndexOf('. ', end);
      if (cutAt <= start) cutAt = text.lastIndexOf(' ', end);

      // Fallback: just cut at maxChars
      const chunk = text.slice(start, cutAt > start ? cutAt + 1 : end).trim();
      if (chunk) chunks.push(chunk);

      // Move start forward, but keep overlap
      start = cutAt > start ? cutAt + 1 : end;
      start -= overlapChars;

      // Safety: ensure we move forward
      if (start >= text.length) {
        break;
      }
      if (chunks.length > 1000) {
        // Prevent infinite loop on weird text
        this.logger.warn('Too many chunks, stopping early');
        break;
      }
    }

    const slimChunks = chunks.map((c) => c.trim()).filter((c) => c.length > 50);
    return slimChunks;
  }

  async makeCallToChunkSummarizer(
    chunks: string[],
    numberOfQuestions = 50,
    questionType = 'multiple_choice',
    difficultyLevel: QuizDifficulty,
    additionalNotes?: string,
  ): Promise<{ quiz: any; masterSummary: string }> {
    if (chunks.length === 0) {
      throw new BadRequestException('No content to summarize');
    }

    this.logger.log(`Processing ${chunks.length} chunks for quiz generation`);

    const chunkSummaries: string[] = [];
    const batchSize = 12; // OpenRouter is strict — 8 is safe

    // Step 1: Summarize chunks in batches
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      const summaries = await Promise.all(
        batch.map((chunk) => this.openRouterSummarizerApi(chunk)),
      );

      chunkSummaries.push(...summaries);

      // Be gentle with OpenRouter
      await new Promise((r) => setTimeout(r, 600));
    }

    // Step 2: Combine all summaries into one master summary
    const masterSummary = await this.combineSummaries(chunkSummaries);

    // Step 3: Generate final quiz ONCE
    const quizJsonString = await this.generateQuizFromSummary(
      masterSummary,
      numberOfQuestions,
      questionType,
      difficultyLevel,
      additionalNotes,
    );

    let quiz;
    try {
      quiz = JSON.parse(quizJsonString);
    } catch (e) {
      this.logger.log(e.message);
      this.logger.error('Failed to parse quiz JSON', quizJsonString);
      quiz = { raw: quizJsonString }; // fallback
    }

    return { quiz, masterSummary };
  }

  private async generateQuizFromSummary(
    summary: string,
    numberOfQuestions: number,
    questionType: string,
    difficultyLevel: QuizDifficulty,
    additionalNotes?: string,
  ): Promise<string> {
    return this.callLLMWithRetry({
      messages: [
        {
          role: 'system',
          content: `Generate exactly ${numberOfQuestions} high-quality ${questionType} questions with a difficulty of ${difficultyLevel}. In the case where the user adds an ${additionalNotes}, add that as part of their request,in a refined manner. If the ${additionalNotes} does not make sense and not improve upon the quality of the question, or is not associated with the content uploaded, ignore it. 
Format as JSON array:
[
  {
    "question": "...",
    "options": ["A. ", "B. ", "C. ", "D. "],
    "answer": "B",
    "explanation": "..."
  }
]
Rules:
- Exactly one correct answer
- Distractors must be plausible
- Include detailed explanation
- Cover different parts of the document`,
        },
        { role: 'user', content: summary },
      ],
      temperature: 0.4,
    });
  }

  private async combineSummaries(summaries: string[]): Promise<string> {
    const combined = summaries.join('\n\n---\n\n');
    return this.callLLMWithRetry({
      messages: [
        {
          role: 'system',
          content:
            'Combine these section summaries into one coherent, concise master summary (max 1500 words). Preserve all key concepts.',
        },
        { role: 'user', content: combined },
      ],
    });
  }
  private async openRouterSummarizerApi(chunk: string): Promise<string> {
    return this.callLLMWithRetry({
      messages: [
        {
          role: 'system',
          content:
            'Summarize this section into clear, examinable bullet points suitable for university-level quiz questions. Focus on definitions, facts, processes, and relationships.',
        },
        { role: 'user', content: chunk },
      ],
      temperature: 0.2,
    });
  }

  private async callLLMWithRetry(params: any, attempt = 1): Promise<string> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    const model = this.configService.get<string>('OPEN_ROUTER_MODEL');

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          // Optional: tell OpenRouter you're not a bot
          'HTTP-Referer': 'https://www.hermexlabs.forxai.me',
          'X-Title': 'Glauk Quiz Generator',
        },
        body: JSON.stringify({
          model,
          messages: params.messages,
          temperature: params.temperature ?? 0.3,
          max_tokens: 15000,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 429 && attempt <= 5) {
          const delay = 3000 * attempt;
          this.logger.warn(
            `Rate limited (429), retry ${attempt}/5 in ${delay}ms`,
          );
          await new Promise((r) => setTimeout(r, delay));
          return this.callLLMWithRetry(params, attempt + 1);
        }
        throw new Error(`OpenRouter error ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      return data.choices[0].message.content.trim(); // ← return string!
    } catch (error) {
      this.logger.error('LLM call failed', error);
      throw new InternalServerErrorException(
        'AI service temporarily unavailable',
      );
    }
  }
}
