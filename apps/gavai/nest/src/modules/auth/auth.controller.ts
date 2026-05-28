import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt.guard';
import { AuthService } from './auth.service';
import { SignupDto, SignupResponseDto } from './dto/signup.dto';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthOpenApi } from './auth.openapi';
import type { JwtPayload } from './types/auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @AuthOpenApi.Signup()
  async signup(@Body() dto: SignupDto): Promise<SignupResponseDto> {
    return this.authService.signup(dto.email, dto.password);
  }

  @Post('login')
  @AuthOpenApi.Login()
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @AuthOpenApi.Refresh()
  async refresh(
    @Body() dto: RefreshDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @AuthOpenApi.Logout()
  async logout(@Body() dto: RefreshDto): Promise<{ success: boolean }> {
    await this.authService.logout(dto.refreshToken);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @AuthOpenApi.Me()
  async me(@Req() req: Request): Promise<unknown> {
    const user = (req as unknown as Record<string, unknown>)[
      'user'
    ] as JwtPayload;
    const foundUser = await this.authService.findUserById(user.sub);
    if (!foundUser) return null;
    return {
      id: foundUser.id,
      email: foundUser.email,
      role: foundUser.role,
      tier: foundUser.tier,
      createdAt: foundUser.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('api-keys')
  @AuthOpenApi.CreateApiKey()
  async createApiKey(
    @Req() req: Request,
  ): Promise<{ rawKey: string; id: string; prefix: string }> {
    const user = (req as unknown as Record<string, unknown>)[
      'user'
    ] as JwtPayload;
    return this.authService.createApiKey(user.sub, user.tier, 100);
  }

  @UseGuards(JwtAuthGuard)
  @Get('api-keys')
  async listApiKeys(@Req() req: Request) {
    const user = (req as unknown as Record<string, unknown>)[
      'user'
    ] as JwtPayload;
    return this.authService.listApiKeys(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('api-keys/:id/rotate')
  async rotateApiKey(@Param('id') id: string) {
    return this.authService.rotateApiKey(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('api-keys/:id')
  async revokeApiKey(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.authService.revokeApiKey(id);
    return { success: true };
  }
}
