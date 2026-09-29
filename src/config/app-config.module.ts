import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './configuration';

/** Validation lives in the appConfig factory (parseEnv), so startup fails there. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] })],
})
export class AppConfigModule {}
