import { Injectable } from '@nestjs/common';
import { SignupDto } from './dto/create-auth.dto';
import { PrismaService } from 'prisma/prisma.service';
import * as bcrypt from 'bcrypt'
import { SignInDto } from './dto/signIn.dto';

import * as jwt from 'jsonwebtoken';
import * as fs from 'fs'
import * as path from 'path'
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService
  ) { }
  async signup(signupdto: SignupDto) {
    try {
      const { email } = signupdto;
      console.log(email)
      const hashedPass = await bcrypt.hashSync(signupdto.password, 8);
      const user = await this.findUniqueUser(email);
      if (user) {
        return "User already exists"
      }

      const createdUser = await this.createUser(signupdto, hashedPass);
      return createdUser;

    } catch (error) {
      console.error(error);
      throw error
    }

  }

  async signIn(signInDto: SignInDto) {
    const user = await this.findUniqueUser(signInDto.email!);
    if (!user) {
      return "User not found"
    }
    if (!user.password) {
      return "User has no password"
    }
    console.log(user.password)
    const isPasswordValid = bcrypt.compareSync(signInDto.password!, user.password);
    if (!isPasswordValid) {
      return "Invalid password"
    }
    const privateKey = fs.readFileSync(
      path.join(process.cwd(), 'keys/private.key'),
      'utf8'
    );

    const token = jwt.sign({ id: user.id, userName: user.username }, privateKey, { algorithm: 'RS256', expiresIn: 7200 })
    return {
      message: `hello ${user.username}`,
      uid: user.id,
      token: token
    }
  }

  async findUniqueUser(email: string) {
    return await this.prisma.user.findUnique({
      where: {
        email
      }
    })
  }

  async createUser(signupdto: SignupDto, hashedPass: string) {

    return await this.prisma.user.create({
      data: {
        email: signupdto.email,
        username: signupdto.username,
        password: hashedPass
      }
    })
  }

}
