import { resolve } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { LocalSaveRepository } from './local-save.repository'
import { SaveController } from './save.controller'
import { SAVE_REPOSITORY, type SaveRepository } from './save.repository'

/** `PERSISTENCE=firestore` in production (the deploy sets it, with `FIRESTORE_DATABASE=cyber`); a local JSON file otherwise. */
export function saveRepository(config: Pick<ConfigService, 'get'>): SaveRepository {
  if ((config.get<string>('PERSISTENCE') ?? 'local') === 'firestore') {
    const database = config.get<string>('FIRESTORE_DATABASE')
    // Never fall back to `(default)`: that's uma-rpg's database (CY3).
    if (!database) throw new Error('FIRESTORE_DATABASE is required with PERSISTENCE=firestore')
    return new FirestoreSaveRepository(database)
  }
  return new LocalSaveRepository(resolve(process.cwd(), config.get<string>('LOCAL_SAVE_FILE') ?? '.data/save.json'))
}

@Module({
  controllers: [SaveController],
  providers: [{ provide: SAVE_REPOSITORY, inject: [ConfigService], useFactory: saveRepository }],
  exports: [SAVE_REPOSITORY],
})
export class SaveModule {}
