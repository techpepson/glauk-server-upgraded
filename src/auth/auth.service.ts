import { MailerService } from '@nestjs-modules/mailer';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HelpersService } from '../helpers/helpers.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AccountUpdateDto, AuthDto, LoginDto } from '../dto/auth.dto';
import { TooManyRequestsException } from '../exceptions/too-many-exceptions';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helper: HelpersService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  logger = new Logger(AuthService.name);

  async manualRegister(payload: AuthDto) {
    console.log(process.env.DATABASE_URL);
    try {
      const user = (await this.helper.userExist(payload.email)).user;

      //check if user
      if (user) {
        throw new ConflictException('User already exists');
      }

      //send email to user to verify their email
      const verificationCode = await this.helper.generateRandomCode(6);

      const appEnv = this.configService.get<string>('app.environment');

      const saltRounds = 10;
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(payload.password, salt);

      const appBaseUrl =
        appEnv === 'production'
          ? this.configService.get<string>('app.appProdBaseUrl')
          : this.configService.get<string>('app.appBaseUrl');

      const verificationUrl = `${appBaseUrl}/auth/verify-email?code=${verificationCode}&email=${payload.email}`;

      const mail = await this.mailerService.sendMail({
        to: payload.email,
        subject: 'Email Verification - Glauk',
        template: 'email-verification', // The `.hbs` extension is appended automatically
        context: {
          verificationCode,
          expirationMinutes: 20,
          name: payload.name,
          appName: this.configService.get<string>('app.appName'),
          logoUrl: this.configService.get('app.appLogoUrl'),
          supportEmail: this.configService.get('app.supportEmail'),
          verifyUrl: verificationUrl,
        },
      });

      const now = new Date();

      const splitName = payload.name.trim().split(' ');
      const firstName = splitName[0];

      //create a new user into the system
      if (mail.accepted.length > 0) {
        await this.prisma.user.create({
          data: {
            email: payload.email.trim(),
            verificationCode,
            password: hashedPassword,
            userName: `${'shark_'}${firstName}`.toLowerCase(),
            name: payload.name.trim(),
            phone: payload.phone.trim(),
            verificationCodeSentAt: now,
          },
        });

        return {
          message:
            'Registration successful. Please check your email to verify your account.',
        };
      } else {
        throw new InternalServerErrorException(
          'Failed to send verification email. Please try again later.',
        );
      }
    } catch (error: any) {
      this.logger.error(`Error in manualRegister: ${error.message}`);
      this.logger.error(error.stack);
      this.logger.error(error.cause);
      if (error instanceof ConflictException) {
        throw new ConflictException('User already exists');
      } else if (error instanceof TooManyRequestsException) {
        throw new InternalServerErrorException(
          'Too many requests. Please try again later.',
        );
      } else {
        throw new InternalServerErrorException(
          error.message ||
            'An error occurred during registration. Please try again later.',
        );
      }
    }
  }

  async verifyEmail(email: string, code: string) {
    try {
      const user = (await this.helper.userExist(email)).user;

      //check if user exists
      if (!user) {
        throw new NotFoundException('User does not exist');
      }

      if (user?.isEmailVerified) {
        throw new ConflictException('Email is already verified');
      }

      if (user?.verificationCode !== code) {
        throw new ConflictException('Invalid verification code');
      }

      await this.prisma.user.update({
        where: { email },
        data: { isEmailVerified: true },
      });

      return { message: 'Email verified successfully', success: true };
    } catch (error: any) {
      this.logger.error(`Error in verifyEmail: ${error.message}`);
      if (error instanceof ConflictException) {
        throw new ConflictException(
          'Email is already verified or invalid verification code',
        );
      } else if (error instanceof NotFoundException) {
        throw new NotFoundException('User does not exist');
      } else if (error instanceof TooManyRequestsException) {
        throw new InternalServerErrorException(
          'Too many verification attempts. Please try again later.',
        );
      } else
        throw new InternalServerErrorException(
          'An error occurred during email verification. Please try again later.',
        );
    }
  }

  async manualLogin(payload: LoginDto) {
    try {
      const user = (await this.helper.userExist(payload.email.trim())).user;

      //check if user exists
      if (!user) {
        throw new NotFoundException('Account not found');
      }

      const isEmailVerified = await this.helper.userEmailVerified(
        payload.email.trim(),
      );

      const userPass = user?.password || '';
      const isPasswordMatching = await bcrypt.compare(
        payload.password,
        userPass,
      );

      if (!isPasswordMatching) {
        throw new ConflictException('Invalid credentials');
      }
      if (!isEmailVerified) {
        throw new ConflictException('Email is not verified');
      }

      //update user first time login flag
      if (user?.isFirstTimeUser) {
        await this.prisma.user.updateMany({
          where: { email: payload.email },
          data: { isFirstTimeUser: false },
        });
      }

      //sign user credentials and generate token
      const token = this.jwtService.sign({
        id: user?.id,
        email: user?.email,
      });
      return {
        message: 'Login successful',
        isFirstTimeUser: user?.isFirstTimeUser,
        isUserRemembered: user?.isUserRemembered || false,
        role: user?.role,
        token,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else if (error instanceof TooManyRequestsException) {
        throw new InternalServerErrorException(
          'Too many login attempts. Please try again later.',
        );
      } else
        throw new InternalServerErrorException(
          'An error occurred during login. Please try again later.',
        );
    }
  }

  async googleAuth(
    email: string,
    firstName: string,
    lastName: string,
    profilePicture: string,
  ) {
    try {
      const user = (await this.helper.userExist(email)).user;

      //check if user exists
      if (user && !user.isEmailVerified) {
        throw new PreconditionFailedException('Email is not verified');
      } else if (user && user.isEmailVerified) {
        const token = this.jwtService.sign({
          id: user.id,
          email: user.email,
        });
        return {
          message: 'Login successful',
          token,
          isFirstTimeUser: user.isFirstTimeUser,
          isUserRemembered: user.isUserRemembered || false,
          role: user.role,
        };
      } else if (!user) {
        const verificationCode = await this.helper.generateRandomCode(6);

        const appBaseUrl = this.configService.get<string>('app.appBaseUrl');
        const verificationUrl = `${appBaseUrl}/verify-email?code=${verificationCode}&email=${email}`;

        //send an email to the user to verify email address
        const mail = await this.mailerService.sendMail({
          to: email,
          subject: 'Email Verification - Glauk',
          template: 'email-verification', // The `.hbs` extension is appended automatically
          context: {
            verificationCode,
            expirationMinutes: 20,
            name: `${firstName} ${lastName}`,
            appName: this.configService.get<string>('app.appName'),
            logoUrl: this.configService.get('app.appLogoUrl'),
            supportEmail: this.configService.get('app.supportEmail'),
            verifyUrl: verificationUrl,
          },
        });

        const now = new Date();
        if (mail.accepted.length > 0) {
          const newUser = await this.prisma.user.create({
            data: {
              email,
              name: `${firstName} ${lastName}`,
              isEmailVerified: false,
              isFirstTimeUser: true,
              password: '',
              phone: '',
              verificationCodeSentAt: now,
              verificationCode,
              userName: `${'shark_'}${firstName}`.toLowerCase(),
              profileImage: profilePicture,
            },
          });

          const token = this.jwtService.sign({
            id: newUser.id,
            email: newUser.email,
          });
          return {
            message: 'Registration successful. Please verify your email.',
            isFirstTimeUser: newUser.isFirstTimeUser,
            isFirstTimeRegister: true,
            isUserRemembered: newUser.isUserRemembered || false,
            role: newUser.role,
            token,
          };
        } else {
          throw new InternalServerErrorException(
            'Failed to send verification email. Please try again later.',
          );
        }
      }
    } catch (error: any) {
      this.logger.error(`Error in googleAuth: ${error.message}`);

      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else if (error instanceof PreconditionFailedException) {
        throw new PreconditionFailedException(error.message);
      } else
        throw new InternalServerErrorException(
          'An error occurred during Google authentication. Please try again later.',
        );
    }
  }

  async resetPassword(email: string, newPassword: string, oldPassword: string) {
    try {
      const user = (await this.helper.userExist(email)).user;

      if (!user) {
        throw new NotFoundException('User does not exist');
      }

      const isOldPasswordValid = await bcrypt.compare(
        oldPassword,
        user.password,
      );

      if (!isOldPasswordValid) {
        throw new ConflictException('Old password is incorrect');
      }

      const saltRounds = 10;
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await this.prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      });

      return { message: 'Password reset successful' };
    } catch (error: any) {
      this.logger.error(`Error in resetPassword: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw new NotFoundException('User does not exist');
      }
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else
        throw new InternalServerErrorException(
          error.message ||
            'An error occurred while resetting password. Please try again later.',
        );
    }
  }

  async rememberUser(email: string) {
    try {
      const user = (await this.helper.userExist(email)).user;

      if (!user) {
        throw new NotFoundException('User does not exist');
      }

      const userRemmbranceStatus = user.isUserRemembered;

      await this.prisma.user.update({
        where: { email },
        data: { isUserRemembered: !userRemmbranceStatus },
      });

      return { message: 'User preference updated successfully', user: email };
    } catch (error: any) {
      this.logger.error(`Error in rememberUser: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw new NotFoundException('User does not exist');
      } else
        throw new InternalServerErrorException(
          error.message ||
            'An error occurred while updating user preference. Please try again later.',
        );
    }
  }

  async deleteAccount(email: string) {
    try {
      const user = (await this.helper.userExist(email)).user;

      if (!user) {
        throw new NotFoundException('User does not exist');
      }

      if (!email) {
        throw new BadRequestException('Email is required to delete account.');
      }
      //perform hard-delete
      await this.prisma.user.delete({
        where: {
          email,
        },
      });

      return {
        message: 'Account deleted successfully.',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async updateDetails(payload: AccountUpdateDto, email: string) {
    try {
      const user = (await this.helper.userExist(email)).user;

      if (!user) {
        throw new NotFoundException('User does not exist');
      }

      await this.prisma.user.update({
        where: { email },
        data: {
          name: payload.name,
          phone: payload.phone,
          userName: payload.userName,
          email: payload.email,
          targetGpa: payload.targetGpa,
          major: payload.major,
          profileImage: payload.profileImage,
          preferEmailNotification: payload.preferEmailNotification,
          preferPushNotification: payload.preferPushNotification,
          preferQuizReminders: payload.preferQuizReminders,
          preferLeaderboardUpdates: payload.preferLeaderboardUpdates,
        },
      });

      return { message: 'Account details updated successfully' };
    } catch (error: any) {
      this.logger.error(`Error in updateDetails: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw new NotFoundException('User does not exist');
      } else
        throw new InternalServerErrorException(
          error.message ||
            'An error occurred while updating account details. Please try again later.',
        );
    }
  }
}
