import { Global, Module } from '@nestjs/common';
import { DrizzleService } from './drizzle.service';

/** @Global is reserved for infrastructure modules. */
@Global()
@Module({
  providers: [DrizzleService],
  exports: [DrizzleService],
})
export class DrizzleModule {}
