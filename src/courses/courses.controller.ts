import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Delete,
  Get,
  Query,
  Patch,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CourseDTO, CourseUpdateDTO } from '../dto/course.dto';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post('add-course')
  @UseGuards(JwtAuthGuard)
  async addCourse(@Req() req: Request, @Body() payload: CourseDTO) {
    const email = (req.user as any).email;
    const result = await this.coursesService.addCourse(payload, email);
    return {
      message: result.message,
      course: result.course,
    };
  }

  @Patch('update-multiple')
  @UseGuards(JwtAuthGuard)
  async updateMultipleCourses(
    @Req() req: Request,
    @Body() payload: CourseUpdateDTO[],
  ) {
    const email = (req.user as any).email;
    const result = await this.coursesService.updateMultipleCourses(
      email,
      payload,
    );
    return {
      message: result.message,
      updatedCourses: result.updatedCourses,
    };
  }

  @Delete('delete-course')
  @UseGuards(JwtAuthGuard)
  async deleteCourse(@Req() req: Request, @Query('courseId') courseId: string) {
    const email = (req.user as any).email;
    const result = await this.coursesService.deleteCourse(email, courseId);
    return {
      message: result.message,
    };
  }

  @Get('fetch-courses')
  @UseGuards(JwtAuthGuard)
  async fetchCourseData(@Req() req: Request) {
    const email = (req.user as any).email;
    const data = await this.coursesService.fetchCourses(email);
    return data;
  }
}
