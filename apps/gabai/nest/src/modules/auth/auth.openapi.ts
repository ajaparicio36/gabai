import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { SignupResponseDto } from './dto/signup.dto';
import { LoginResponseDto } from './dto/login.dto';

@ApiTags('Auth')
export class AuthOpenApi {
  static Signup(): MethodDecorator {
    return applyDecorators(
      ApiOperation({ summary: 'Register a new user' }),
      ApiResponse({
        status: 201,
        description: 'User created',
        type: SignupResponseDto,
      }),
      ApiResponse({ status: 409, description: 'Email already registered' }),
    );
  }

  static Login(): MethodDecorator {
    return applyDecorators(
      ApiOperation({ summary: 'Login with email and password' }),
      ApiResponse({
        status: 200,
        description: 'Returns access + refresh tokens',
        type: LoginResponseDto,
      }),
      ApiResponse({ status: 401, description: 'Invalid credentials' }),
    );
  }

  static Refresh(): MethodDecorator {
    return applyDecorators(
      ApiOperation({ summary: 'Refresh access token' }),
      ApiResponse({ status: 200, description: 'New token pair' }),
      ApiResponse({
        status: 401,
        description: 'Invalid or revoked refresh token',
      }),
    );
  }

  static Logout(): MethodDecorator {
    return applyDecorators(
      ApiOperation({ summary: 'Logout and revoke refresh token' }),
      ApiResponse({ status: 200, description: 'Logged out' }),
    );
  }

  static Me(): MethodDecorator {
    return applyDecorators(
      ApiBearerAuth(),
      ApiOperation({ summary: 'Get current user profile' }),
      ApiResponse({ status: 200, description: 'User profile' }),
      ApiResponse({ status: 401, description: 'Unauthorized' }),
    );
  }

  static CreateApiKey(): MethodDecorator {
    return applyDecorators(
      ApiBearerAuth(),
      ApiOperation({ summary: 'Generate a new API key' }),
      ApiResponse({ status: 201, description: 'API key created' }),
    );
  }
}
