import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseService } from '../db';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  getHealth(@Res() res: Response): void {
    const ok = this.database.health().ok;
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({ status: ok ? 'ok' : 'degraded' });
  }
}
