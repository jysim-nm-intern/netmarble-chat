import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Query,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatRoomApplicationService } from '../../application/service/chat-room-application.service.js';
import { MessageApplicationService } from '../../application/service/message-application.service.js';
import { StompBrokerService } from '../../infrastructure/config/stomp-broker.service.js';
import {
  ChatRoomResponse,
  ChatRoomMemberResponse,
  CreateChatRoomRequest,
  JoinChatRoomRequest,
  MessageResponse,
  SendMessageRequest,
  UpdateActiveStatusRequest,
} from '../../application/dto/index.js';

@Controller('api/chat-rooms')
export class ChatRoomController {
  private readonly logger = new Logger(ChatRoomController.name);

  constructor(
    private readonly chatRoomService: ChatRoomApplicationService,
    private readonly messageService: MessageApplicationService,
    private readonly stompBroker: StompBrokerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('image'))
  async createChatRoom(
    @Body('name') name: string,
    @Body('creatorId') creatorIdStr: string,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<ChatRoomResponse> {
    let imageUrl: string | null = null;
    if (image && image.size > 0) {
      imageUrl = this.encodeImageToBase64(image);
    }
    const request = new CreateChatRoomRequest();
    request.name = name;
    request.creatorId = parseInt(creatorIdStr, 10);
    request.imageUrl = imageUrl;
    return this.chatRoomService.createChatRoom(request);
  }

  @Get()
  async getAllActiveChatRooms(
    @Query('userId') userIdStr?: string,
  ): Promise<ChatRoomResponse[]> {
    const userId = userIdStr ? parseInt(userIdStr, 10) : null;
    return this.chatRoomService.getAllActiveChatRooms(userId);
  }

  @Get(':id')
  async getChatRoomById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ChatRoomResponse> {
    return this.chatRoomService.getChatRoomById(id);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  async joinChatRoom(
    @Param('id', ParseIntPipe) id: number,
    @Query('userId') userIdStr: string,
  ): Promise<ChatRoomResponse> {
    const request = new JoinChatRoomRequest();
    request.chatRoomId = id;
    request.userId = parseInt(userIdStr, 10);
    return this.chatRoomService.joinChatRoom(request);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leaveChatRoom(
    @Param('id', ParseIntPipe) id: number,
    @Query('userId') userIdStr: string,
  ): Promise<void> {
    await this.chatRoomService.leaveChatRoom(id, parseInt(userIdStr, 10));
  }

  @Get(':id/members')
  async getChatRoomMembers(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ChatRoomMemberResponse[]> {
    return this.chatRoomService.getActiveChatRoomMembers(id);
  }

  @Put(':id/members/status')
  async updateMemberStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: UpdateActiveStatusRequest,
  ): Promise<void> {
    await this.chatRoomService.updateMemberActiveStatus(
      id,
      request.userId,
      request.online,
    );
  }

  @Post(':id/members/heartbeat')
  async heartbeat(
    @Param('id', ParseIntPipe) id: number,
    @Query('userId') userIdStr: string,
  ): Promise<void> {
    await this.chatRoomService.updateMemberActivity(
      id,
      parseInt(userIdStr, 10),
    );
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: SendMessageRequest,
  ): Promise<MessageResponse> {
    if (!request.chatRoomId) request.chatRoomId = id;
    const response = await this.messageService.sendMessage(request);
    this.stompBroker.send(
      `/topic/chatroom.${id}`,
      JSON.stringify(response),
    );
    return response;
  }

  @Post(':id/messages/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @Query('userId') userIdStr: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<MessageResponse> {
    if (!file || file.size === 0) throw new Error('파일이 비어있습니다.');
    if (!file.mimetype.startsWith('image/'))
      throw new Error('이미지 파일만 업로드 가능합니다.');
    if (file.size > 7.5 * 1024 * 1024)
      throw new Error('파일 크기가 7.5MB를 초과합니다.');

    const base64 = file.buffer.toString('base64');
    const ext = this.getImageFormat(file.originalname);
    const request = new SendMessageRequest();
    request.chatRoomId = id;
    request.senderId = parseInt(userIdStr, 10);
    request.content = `data:image/${ext};base64,${base64}`;
    request.messageType = 'IMAGE';
    request.fileName = file.originalname;

    const response = await this.messageService.sendMessage(request);
    this.stompBroker.send(
      `/topic/chatroom.${id}`,
      JSON.stringify(response),
    );
    return response;
  }

  @Get(':id/messages/search')
  async searchMessages(
    @Param('id', ParseIntPipe) id: number,
    @Query('keyword') keyword: string,
  ): Promise<MessageResponse[]> {
    return this.messageService.searchMessages(id, keyword);
  }

  private encodeImageToBase64(image: Express.Multer.File): string {
    const contentType = image.mimetype;
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(contentType))
      throw new Error('JPG, PNG, GIF 형식만 지원합니다.');
    if (image.size > 5 * 1024 * 1024)
      throw new Error('이미지 크기가 5MB를 초과합니다.');
    const base64 = image.buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  }

  private getImageFormat(filename: string): string {
    if (!filename) return 'jpeg';
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpeg';
    return ext === 'jpg' ? 'jpeg' : ext;
  }
}
