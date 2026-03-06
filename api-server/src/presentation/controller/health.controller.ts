import { Controller, Get } from '@nestjs/common';

@Controller('api')
export class HealthController {
  @Get('health')
  health(): { status: string; message: string } {
    return { status: 'OK', message: 'Server is running' };
  }
}
