import { resolve } from 'node:path'
import { AuthModule, authMode } from '@luismlorenzana/uma-server/auth'
import { ReleaseProxyModule } from '@luismlorenzana/uma-server/content'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { HealthController } from './health.controller'
import { SaveModule } from './save/save.module'
import { storyPackModule } from './story/story-pack'

// Every route sits behind the shared owner guard (uma-platform P54): a Firebase ID token for the owner's email, or the
// fixed local user with AUTH_MODE=disabled. `@Public()` opens a route (only /api/health).
// Master data is uma-platform's private release, proxied to the signed-in owner at /api/master/… (as uma-rpg and
// uma-quest do): MASTER_BUCKET in production, uma-platform's local release folder in dev.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ mode: authMode(config.get<string>('AUTH_MODE')), allowedEmail: config.get<string>('ALLOWED_EMAIL') ?? '' }),
    }),
    ReleaseProxyModule.forRoot({
      route: 'master',
      bucket: process.env.MASTER_BUCKET,
      dir: resolve(process.cwd(), process.env.MASTER_DIR ?? '../../../uma-platform/content/release'),
    }),
    SaveModule,
    // The story's private pack at /api/content/… (CY9): STORY_DIR locally, the stand-in in production until Phase 4.
    storyPackModule(),
  ],
  controllers: [HealthController],
})
export class AppModule {}
