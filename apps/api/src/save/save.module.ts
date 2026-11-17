import { resolve } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { LocalSaveRepository } from './local-save.repository'
import { CampaignSaveController, SaveController } from './save.controller'
import { CAMPAIGN_SAVE_REPOSITORY, SAVE_REPOSITORY, type SaveRepository } from './save.repository'

/** `PERSISTENCE=firestore` in production (the deploy sets it, with `FIRESTORE_DATABASE=cyber`); a local JSON file otherwise. */
export function saveRepository(config: Pick<ConfigService, 'get'>, campaign = false): SaveRepository {
  if ((config.get<string>('PERSISTENCE') ?? 'local') === 'firestore') {
    const database = config.get<string>('FIRESTORE_DATABASE')
    // Never fall back to `(default)`: that's uma-rpg's database (CY3).
    if (!database) throw new Error('FIRESTORE_DATABASE is required with PERSISTENCE=firestore')
    return new FirestoreSaveRepository(database, campaign)
  }
  const file = resolve(process.cwd(), config.get<string>('LOCAL_SAVE_FILE') ?? '.data/save.json')
  return new LocalSaveRepository(campaign ? `${file}.campaign` : file)
}

@Module({
  controllers: [SaveController, CampaignSaveController],
  providers: [
    { provide: SAVE_REPOSITORY, inject: [ConfigService], useFactory: saveRepository },
    { provide: CAMPAIGN_SAVE_REPOSITORY, inject: [ConfigService], useFactory: (config: ConfigService) => saveRepository(config, true) },
  ],
  exports: [SAVE_REPOSITORY],
})
export class SaveModule {}
