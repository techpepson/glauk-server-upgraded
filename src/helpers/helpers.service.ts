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
import PptxParser from 'node-pptx-parser';

import { ConfigService } from '@nestjs/config';

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

    const userCredit = user?.totalCredits;

    if (userCredit! < requiredCredit) {
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

  async extractFileContent(file: Express.Multer.File, email: string) {
    try {
      const originalname = file.originalname;

      const ext = originalname.split('.').pop();

      if (ext == 'pdf') {
        const parseFileToSupabase = await this.parseFileToSupabase(file, email);

        const pdfUrl = parseFileToSupabase.publicUrl;

        const parser = new PDFParse({ url: pdfUrl });

        const pdfText = await parser.getText();
        const pdfInfo = await parser.getInfo();
        const pdfTable = await parser.getTable();

        await parser.destroy();

        return {
          rawText: pdfText,
          info: pdfInfo ?? null,
          table: pdfTable ?? null,
          url: pdfUrl,
        };
      } else {
        const fileParser = await this.parseFileToSupabase(file, email);

        const slideContent = '';
        const parser = new PptxParser(fileParser.publicUrl);

        const pptx = await parser.parse();

        pptx.slides.forEach((slide) => {
          slide.parsed.forEach((shape: any) => {
            if (shape.text) {
              slideContent.concat(shape.text + '\n');
            }
          });
        });

        return {
          rawText: slideContent,
          url: fileParser.publicUrl,
        };
      }
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException('Pdf Parsing Failed');
    }
  }

  async chunkText(text:string, maxContext = 10000) {}
}
