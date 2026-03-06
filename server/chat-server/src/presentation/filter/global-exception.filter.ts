import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '서버 내부 오류가 발생했습니다.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message ?? message;
    } else if (exception instanceof Error) {
      message = exception.message;
      if (message.includes('찾을 수 없습니다')) {
        status = HttpStatus.NOT_FOUND;
      } else if (
        message.includes('권한이 없습니다') ||
        message.includes('참여하지 않은')
      ) {
        status = HttpStatus.FORBIDDEN;
      } else if (
        message.includes('비어있을 수 없습니다') ||
        message.includes('초과할 수 없습니다') ||
        message.includes('형식만 지원')
      ) {
        status = HttpStatus.BAD_REQUEST;
      }
    }

    this.logger.error(`[${status}] ${message}`, exception instanceof Error ? exception.stack : '');

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
