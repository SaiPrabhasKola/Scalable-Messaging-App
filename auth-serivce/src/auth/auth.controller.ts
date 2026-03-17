import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/create-auth.dto';
import { SignInDto } from './dto/signIn.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('/sign-up')
  create(@Body() signupdto: SignupDto) {
    return this.authService.signup(signupdto);
  }

  @Post('/sign-in')
  signIn(
    @Body() signInDto: SignInDto
  ) {
    return this.authService.signIn(signInDto);
  }
}