import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Inject, Logger, Put } from '@nestjs/common'
import { CurrentUid } from '@luismlorenzana/uma-server/auth'
import { parseSavePut, SaveParseError, type SaveEnvelope } from '@cyber/domain'
import { CAMPAIGN_SAVE_REPOSITORY, FOUR_ACT_SAVE_REPOSITORY, PILOT_SAVE_REPOSITORY, RevisionConflict, SAVE_REPOSITORY, type SaveRepository } from './save.repository'

// GET and PUT /api/save behind the owner guard (copied from uma-rpg at 30a322a). The server stores what the device sends
// and never writes into a save itself (the production-save rules).
@Controller('save')
export class SaveController {
  private readonly logger = new Logger(SaveController.name)

  constructor(@Inject(SAVE_REPOSITORY) private readonly saves: SaveRepository) {}

  @Get()
  load(@CurrentUid() uid: string): Promise<SaveEnvelope> {
    return this.saves.load(uid)
  }

  /** 409 carries the stored envelope so the device can reconcile and retry (uma-rpg D32). */
  @Put()
  async put(@CurrentUid() uid: string, @Body() body: unknown): Promise<SaveEnvelope> {
    let request
    try {
      request = parseSavePut(body)
    } catch (err) {
      await this.keepRefused(uid, body, err)
      if (err instanceof SaveParseError) throw new BadRequestException(err.message)
      throw err
    }
    if (request.save.account.uid !== uid) throw new ForbiddenException('Save belongs to a different account')
    try {
      return await this.saves.put(uid, request.baseRevision, request.save, request.sentVersion)
    } catch (err) {
      if (err instanceof RevisionConflict) throw new ConflictException({ message: 'revision conflict', current: err.current })
      await this.keepRefused(uid, body, err)
      throw err
    }
  }

  /** A refused upload may be the only copy of the player's progress (uma-rpg D260), so it's kept, and failing to keep it
   * never hides why. */
  private async keepRefused(uid: string, body: unknown, err: unknown): Promise<void> {
    const reason = err instanceof Error ? err.message : String(err)
    this.logger.error(`Save upload refused: ${reason}`)
    try {
      await this.saves.rescue(uid, body, reason)
    } catch (failure) {
      this.logger.error(`Save rescue failed: ${failure instanceof Error ? failure.message : String(failure)}`)
    }
  }
}

@Controller('campaign/save')
export class CampaignSaveController extends SaveController {
  constructor(@Inject(CAMPAIGN_SAVE_REPOSITORY) saves: SaveRepository) {
    super(saves)
  }
}

@Controller('campaign/pilot/save')
export class PilotSaveController extends SaveController {
  constructor(@Inject(PILOT_SAVE_REPOSITORY) saves: SaveRepository) {
    super(saves)
  }
}

@Controller('campaign/four-act/save')
export class FourActSaveController extends SaveController {
  constructor(@Inject(FOUR_ACT_SAVE_REPOSITORY) saves: SaveRepository) {
    super(saves)
  }
}
