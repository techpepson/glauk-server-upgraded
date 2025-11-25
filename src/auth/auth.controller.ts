import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AccountUpdateDto, AuthDto, LoginDto } from '../dto/auth.dto';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthGuard } from './google-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  async manualRegister(@Body() payload: AuthDto) {
    const registration = await this.authService.manualRegister(payload);
    return {
      message: registration.message,
    };
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Get('login')
  async manualLogin(@Body() payload: LoginDto) {
    const login = await this.authService.manualLogin(payload);
    return {
      message: login.message,
      token: login.token,
      isFirstTimeUser: login.isFirstTimeUser,
      isUserRemembered: login.isUserRemembered,
      role: login.role,
    };
  }

  @Get('verify-email')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async verifyEmail(
    @Query('email') email: string,
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    const verification = await this.authService.verifyEmail(email, code);

    if (verification.success) {
      res.render('verification-success', {
        logoUrl: this.configService.get<string>('app.appLogoUrl'),
        appName: this.configService.get<string>('app.appName'),
        message: verification.message,
        loginUrl: this.configService.get<string>('app.appBaseUrl') + '/login',
        homeUrl: this.configService.get<string>('app.appBaseUrl'),
        supportEmail: this.configService.get<string>('app.supportEmail'),
      });
    } else {
      return {
        message: 'Email verification failed',
      };
    }
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuthGuard() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;

    const googleCallBack = await this.authService.googleAuth(
      user.email,
      user.firstName,
      user.lastName,
      user.picture,
    );

    //redirect user to client with token
    const clientBaseUrl = this.configService.get<string>(
      'app.appClientBaseUrl',
    );
    //redirect to different urls based on first time user or not
    if (googleCallBack?.isFirstTimeRegister) {
      const loginUrl = `${clientBaseUrl}/auth/success?token=${googleCallBack.token}&isFirstTimeUser=${googleCallBack.isFirstTimeUser}`;
      res.redirect(loginUrl);
    } else if (googleCallBack?.isFirstTimeUser) {
      const introScreenUrl = `${clientBaseUrl}/auth/intro?token=${googleCallBack.token}&isFirstTimeUser=${googleCallBack.isFirstTimeUser}`;
      res.redirect(introScreenUrl);
    } else {
      const dashboardUrl = `${clientBaseUrl}/dashboard?token=${googleCallBack?.token}`;
      res.redirect(dashboardUrl);
    }
  }

  @Get('remember-user')
  @UseGuards(JwtAuthGuard)
  async rememberUser(@Req() req: Request) {
    const email = (req.user as any).email;
    const rememberService = await this.authService.rememberUser(email);

    return {
      message: rememberService.message,
    };
  }

  @Delete('delete-account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: Request) {
    const email = (req.user as any).email;

    const deleteService = await this.authService.deleteAccount(email);

    return {
      message: deleteService.message,
    };
  }

  @Post('reset-password')
  @UseGuards(JwtAuthGuard)
  async resetPassword(
    @Req() req: Request,
    @Body('oldPassword') oldPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    const email = (req.user as any).email;
    const resetService = await this.authService.resetPassword(
      email,
      newPassword,
      oldPassword,
    );

    return {
      message: resetService.message,
    };
  }

  @Patch('update-details')
  @UseGuards(JwtAuthGuard)
  async updateDetails(@Req() req: Request, @Body() payload: AccountUpdateDto) {
    const email = (req.user as any).email;
    const updateService = await this.authService.updateDetails(payload, email);

    return {
      message: updateService.message,
    };
  }
}
