import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, setupSwagger } from './app.setup.js';

const app = await NestFactory.create(AppModule);
const config = configureApp(app);
if (config.SWAGGER_ENABLED) setupSwagger(app);

await app.listen(config.PORT, '0.0.0.0');
Logger.log(`API ready on http://localhost:${config.PORT}/v1 (docs: /docs)`, 'Bootstrap');
