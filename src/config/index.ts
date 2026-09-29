import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from './configuration';

export type AppConfigService = ConfigService<{ app: AppConfig }, true>;
export type { AppConfig } from './configuration';
