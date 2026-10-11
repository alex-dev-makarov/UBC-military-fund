import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule, type ValidatedEnv } from './app';
import { securityHeaders } from './shared/http';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.disable('x-powered-by');

  const configService = app.get<ConfigService<ValidatedEnv, true>>(ConfigService);

  app.use(securityHeaders(configService.get('APP_ENV', { infer: true }) !== 'local'));
  app.use(cookieParser());

  const frontendOriginStr = configService.get('FRONTEND_ORIGIN', { infer: true });
  if (!frontendOriginStr) {
    throw new Error('FRONTEND_ORIGIN is required (credentialed CORS cannot use a default)');
  }

  const allowedOrigins = frontendOriginStr.split(',').map(origin => origin.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = configService.get('PORT', { infer: true });

  await app.listen(port);

  console.log(`API listening on port ${port} (APP_ENV=${configService.get('APP_ENV', { infer: true })})`);
  console.log(`Allowed CORS origins:`, allowedOrigins);
}

bootstrap();
