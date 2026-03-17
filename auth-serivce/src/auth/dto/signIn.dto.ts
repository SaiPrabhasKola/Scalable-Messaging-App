import { PartialType } from '@nestjs/mapped-types';
import { SignupDto } from './create-auth.dto';

export class SignInDto extends PartialType(SignupDto) { }
