import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from '../constants/jwt.constants';
import { HelpersService } from '../helpers/helpers.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { PrismaService } from '../prisma/prisma.service';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { GoogleStrategy } from './google.strategy';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '1h' },
    }),
    // Import MailerModule to get MailerService and its provider tokens (MAILER_OPTIONS)
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
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    HelpersService,
    PrismaService,
    GoogleStrategy,
  ],
  exports: [],
})
export class AuthModule {}
