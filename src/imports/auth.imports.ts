import { AuthDto } from '../dto/auth.dto';
import { HelpersService } from '../helpers/helpers.service';
import { PrismaService } from '../prisma/prisma.service';
import { TooManyRequestsException } from '../exceptions/too-many-exceptions';

const Defaults = {
  AuthDto,
  HelpersService,
  PrismaService,
  TooManyRequestsException,
};

export default Defaults;
