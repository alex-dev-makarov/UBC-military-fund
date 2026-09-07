import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DatabaseService } from '../db';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  getHealth(@Res() res: Response): void {
    const db = this.database.health();

    res
      .status(db.ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json({
        status: db.ok ? 'ok' : 'degraded',
        uptime: process.uptime(),
        db,
      });
  }
}
