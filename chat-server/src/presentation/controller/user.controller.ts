import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserApplicationService } from '../../application/service/user-application.service.js';
import { CreateUserRequest, UserResponse } from '../../application/dto/index.js';

@Controller('api/users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userApplicationService: UserApplicationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('image'))
  async createUser(
    @Body('nickname') nickname: string,
    @Body('profileColor') profileColor?: string,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<UserResponse> {
    this.logger.log(`POST /api/users - nickname: ${nickname}`);
    let profileImage: string | null = null;
    if (image && image.size > 0) {
      profileImage = this.encodeImageToBase64(image);
    }
    const request = new CreateUserRequest();
    request.nickname = nickname;
    request.profileColor = profileColor;
    request.profileImage = profileImage;
    return this.userApplicationService.createUser(request);
  }

  @Get('active')
  async getActiveUsers(): Promise<UserResponse[]> {
    return this.userApplicationService.getActiveUsers();
  }

  @Get('check-nickname')
  async checkNickname(
    @Query('nickname') nickname: string,
  ): Promise<{ available: boolean }> {
    const available =
      await this.userApplicationService.isNicknameAvailable(nickname);
    return { available };
  }

  @Get('nickname/:nickname')
  async getUserByNickname(
    @Param('nickname') nickname: string,
  ): Promise<UserResponse> {
    return this.userApplicationService.getUserByNickname(nickname);
  }

  @Get(':id')
  async getUserById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserResponse> {
    return this.userApplicationService.getUserById(id);
  }

  @Put(':id/activity')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateActivity(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.userApplicationService.updateUserActivity(id);
  }

  private encodeImageToBase64(image: Express.Multer.File): string {
    const contentType = image.mimetype;
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(contentType)) {
      throw new Error('JPG, PNG, GIF 형식만 지원합니다.');
    }
    if (image.size > 5 * 1024 * 1024) {
      throw new Error('이미지 크기가 5MB를 초과합니다.');
    }
    const base64 = image.buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  }
}
