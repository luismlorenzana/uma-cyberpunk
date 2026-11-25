import { resolve } from 'node:path'
import type { CampaignSaveScope } from '@cyber/domain'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { LocalSaveRepository } from './local-save.repository'
import { CampaignSaveController, FourActSaveController, PilotSaveController, SaveController } from './save.controller'
import { CAMPAIGN_SAVE_REPOSITORY, FOUR_ACT_SAVE_REPOSITORY, PILOT_SAVE_REPOSITORY, SAVE_REPOSITORY, type SaveRepository } from './save.repository'

/** `PERSISTENCE=firestore` in production (the deploy sets it, with `FIRESTORE_DATABASE=cyber`); a local JSON file otherwise. */
export function saveRepository(config: Pick<ConfigService, 'get'>, scope: CampaignSaveScope = 'legacy'): SaveRepository {
  if ((config.get<string>('PERSISTENCE') ?? 'local') === 'firestore') {
    const database = config.get<string>('FIRESTORE_DATABASE')
    // Never fall back to `(default)`: that's uma-rpg's database (CY3).
    if (!database) throw new Error('FIRESTORE_DATABASE is required with PERSISTENCE=firestore')
    return new FirestoreSaveRepository(database, scope)
  }
  const file = resolve(process.cwd(), config.get<string>('LOCAL_SAVE_FILE') ?? '.data/save.json')
  const suffix = { legacy: '', current: '.campaign', pilot: '.campaign-pilot', 'four-act': '.campaign-four-act' }[scope]
  return new LocalSaveRepository(file + suffix)
}

@Module({
  controllers: [SaveController, CampaignSaveController, PilotSaveController, FourActSaveController],
  providers: [
    { provide: SAVE_REPOSITORY, inject: [ConfigService], useFactory: saveRepository },
    { provide: CAMPAIGN_SAVE_REPOSITORY, inject: [ConfigService], useFactory: (config: ConfigService) => saveRepository(config, 'current') },
    { provide: PILOT_SAVE_REPOSITORY, inject: [ConfigService], useFactory: (config: ConfigService) => saveRepository(config, 'pilot') },
    { provide: FOUR_ACT_SAVE_REPOSITORY, inject: [ConfigService], useFactory: (config: ConfigService) => saveRepository(config, 'four-act') },
  ],
  exports: [SAVE_REPOSITORY],
})
export class SaveModule {}
