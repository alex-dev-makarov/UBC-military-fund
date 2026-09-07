import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AppModule, type ValidatedEnv } from './app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const configService = app.get<ConfigService<ValidatedEnv, true>>(ConfigService);

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

  console.log(`API listening on port ${port}`);
  console.log(`Allowed CORS origins:`, allowedOrigins);
}

bootstrap();
