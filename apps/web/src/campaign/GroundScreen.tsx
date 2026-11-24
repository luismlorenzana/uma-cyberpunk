import type { BattleAction, BattleInput } from '@cyber/battle'
import { awayMembers, chooseSubclass, COMBAT_SUBCLASSES, FORMATION_NAME, PARTS_BY_ID, resting, SUBCLASS_NAME, trainingOf,
  type CampaignRelease, type CampaignReleaseFile, type GroundEncounter, type Mission, type Save, type StoryPack } from '@cyber/domain'
import type { StageLayout } from '@luismlorenzana/uma-stage'
import { useEffect, useState } from 'react'
import { BattleView } from '../battle/BattleView'
import { resume } from '../battle/session'
import { deploy, finishBattle, recordAction, retry, setSquad, toDeploy } from '../mission/director'
import { updateSave } from '../save/game'
import { lifeAboardInput, SCENARIOS } from '../mission/battleInput'
import { moveToSquad } from '../crew/squads'
import { settleGround } from './ground'
import { campaignImage } from './load'
import { nameOf } from '../story/runner'
import { groundInput, settleTraining, TRAINING_EXPANSION, TRAINING_MAIN } from './training'
import { fittedGroundRig, fittedSummary } from './workshop'
import { formationReady, specialistInput } from './specialist-input'

const action = 'min-h-11 rounded-lg bg-white/10 px-4 text-sm font-bold text-white'
const primary = 'min-h-11 rounded-lg bg-[#2ee6ff] px-4 font-bold text-[#0b0d17]'
const panel = 'absolute inset-0 overflow-auto bg-[#0b0d17] p-4 text-[#e8ebf5]'
const insets = { margin: 'var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left)' }

export default function GroundScreen({ save, mission, layout, trainee, label, close, ground, pack, bossArt, combatSprites, acceptsFitted, ashore, editableSquad, combatShift }: {
  save: Save; mission: Mission; layout: StageLayout; trainee: number; label: string; close: () => void
  ground?: GroundEncounter; pack: StoryPack; bossArt?: CampaignReleaseFile
  combatSprites?: CampaignRelease['combatSprites']
  acceptsFitted?: boolean
  ashore?: ReadonlySet<number>
  editableSquad?: boolean
  combatShift?: string
}) {
  const state = save.mission
  const parts = (ids: readonly string[]) => ids.map((id) => ({ id, name: PARTS_BY_ID.get(id)!.name, details: PARTS_BY_ID.get(id)!.note }))
  const weapons = ground?.kit ? parts(ground.kit.weapons) : TRAINING_MAIN
  const expansions = ground?.kit ? parts(ground.kit.expansions) : TRAINING_EXPANSION
  const [main, setMain] = useState<string>(weapons[0]!.id)
  const [expansion, setExpansion] = useState<string>(expansions[0]!.id)
  const [useFitted, setUseFitted] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [specialistTraining, setSpecialistTraining] = useState(false)
  const [alternateFit, setAlternateFit] = useState<Record<number, boolean>>({})
  const [deploymentError, setDeploymentError] = useState<string | null>(null)
  const [portrait, setPortrait] = useState<string | null>()
  useEffect(() => {
    if (!bossArt) return
    let live = true
    let url: string | undefined
    void campaignImage(bossArt).then((value) => {
      if (!live) { URL.revokeObjectURL(value); return }
      url = value
      setPortrait(value)
    }, () => { if (live) setPortrait(null) })
    return () => { live = false; if (url) URL.revokeObjectURL(url) }
  }, [bossArt])
  if (!state) return null
  const title = ground?.title ?? 'Training'
  const alternate = ground?.alternate && save.story.flags.includes(ground.alternate.flag) ? ground.alternate : undefined
  const scenario = alternate?.scenario ?? mission.scenario
  const combat = ground?.combat ?? (specialistTraining && scenario === 'training' ? { kind: 'uma' as const } : undefined)
  const shifted = !!combatShift && save.story.flags.includes(combatShift)
  const fitted = acceptsFitted && scenario
    ? fittedGroundRig(save.crew.find(({ outfit }) => outfit === trainee)?.rig, scenario, ground?.expansion) : null
  const approach = ground?.alternate ? alternate?.label ?? ground.alternate.closedLabel ?? 'Cargo airlock' : undefined
  const capacity = Math.min(combat?.kind === 'uma' ? 5 : 4, (scenario && SCENARIOS[scenario]?.input.units.filter(({ side }) => side === 'squad').length) || 1)
  const eligible = (s: Save, outfit: number) => !ashore?.has(outfit) && !awayMembers(s.operations, s.squads).includes(outfit)
    && s.crew.some((member) => member.outfit === outfit && !resting(member))
  if (launching) return <div className={panel} style={insets} role="status">Saving deployment…</div>
  if (state.step === 'battle' && state.battle) {
    if (bossArt && portrait === undefined) return <div className={panel} style={insets} role="status">Preparing the battle…</div>
    return <GroundBattle layout={layout} input={state.battle.input as BattleInput} actions={state.battle.actions as BattleAction[]} close={close}
      combatSprites={combatSprites}
      mission={mission.id} interior={!!ground} title={ground?.title} portrait={portrait && ground?.boss ? { url: portrait, unit: ground.boss.unit } : undefined} />
  }
  if (!scenario || !Object.hasOwn(SCENARIOS, scenario)) return <main className={panel} style={insets}>
    <p role="alert">The battle layout is unavailable.</p><button type="button" className={action} onClick={close}>Campaign</button>
  </main>
  return (
    <main className={panel} style={insets} data-training={state.step}>
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="font-display text-2xl font-bold">{state.step === 'briefing' ? title
          : state.step === 'deploy' ? `${title} Hangar` : state.won ? (ground ? 'Objective secured' : 'Exercise passed') : (ground ? 'Squad withdrew' : 'Exercise lost')}</h1>
        {approach && state.step !== 'results' && <p className="text-sm font-semibold text-cyan-200">{approach}</p>}
        {state.step === 'briefing' && <>
          <p className="text-sm text-white/80">{mission.brief}</p>
          <div className="flex gap-2">
            <button type="button" className={primary} onClick={() => void updateSave(toDeploy)}>Prepare gear</button>
            <button type="button" className={action} onClick={close}>Campaign</button>
          </div>
        </>}
        {state.step === 'deploy' && <>
          <p className="font-semibold">{label}</p>
          {scenario === 'training' && <button type="button" className={action} aria-pressed={specialistTraining}
            onClick={() => setSpecialistTraining(!specialistTraining)}>Laser specialist practice</button>}
          {combat?.kind === 'combined' && <div className="grid grid-cols-2 gap-2" aria-label="Combined formation">
            {combat.members.map(({ role, outfit, heroine }) => <p key={outfit ?? heroine} className="rounded bg-white/5 p-2 text-sm">
              <b>{FORMATION_NAME[role]}</b> · {nameOf(pack, outfit ?? heroine ?? null)}
            </p>)}
          </div>}
          {(editableSquad || combat?.kind === 'uma') && combat?.kind !== 'combined' && <details className="rounded-lg bg-white/5 p-2">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">Squad · {state.squad.length}/{capacity}</summary>
            <div className="flex flex-wrap gap-2">
              {save.crew.map((member) => {
                const active = state.squad.includes(member.outfit)
                const reason = member.outfit === trainee ? 'Mission lead' : ashore?.has(member.outfit) ? 'Ashore'
                  : resting(member) ? 'Resting' : awayMembers(save.operations, save.squads).includes(member.outfit) ? 'Away' : null
                return <button type="button" key={member.outfit} className={`${action} disabled:opacity-60 aria-pressed:ring-2 aria-pressed:ring-cyan-300`}
                  aria-pressed={active} disabled={!!reason || (!active && state.squad.length >= capacity)} onClick={() => void updateSave((current) => {
                    if (current.mission?.id !== mission.id || current.mission.step !== 'deploy' || !eligible(current, member.outfit)) return current
                    const squad = current.mission.squad
                    return squad.includes(member.outfit) ? setSquad(current, squad.filter((outfit) => outfit !== member.outfit))
                      : squad.length < capacity ? setSquad(current, [...squad, member.outfit]) : current
                  })}>{nameOf(pack, member.outfit)} · {reason ?? member.role ?? pack.casting.roles?.[member.outfit] ?? 'Crew'}</button>
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {save.squads.map((squad) => <button type="button" className={action} key={squad.id} onClick={() => void updateSave((current) => {
                if (current.mission?.id !== mission.id || current.mission.step !== 'deploy') return current
                const selected = current.squads.find(({ id }) => id === squad.id)
                return selected ? setSquad(current, [...new Set([trainee, ...selected.members.filter((outfit) => eligible(current, outfit))])].slice(0, capacity)) : current
              })}>Use {squad.name}</button>)}
              {state.squad.length > 1 && <button type="button" className={action} onClick={() => void updateSave((current) => {
                if (current.mission?.id !== mission.id || current.mission.step !== 'deploy') return current
                const available = current.mission.squad.filter((outfit) => eligible(current, outfit))
                const [lead, ...members] = available
                if (!lead) return current
                const created = moveToSquad(current, lead, 'new')
                const id = created === current ? undefined : created.squads.at(-1)?.id
                return id ? members.reduce((next, outfit) => moveToSquad(next, outfit, id), created) : current
              })}>Save as squad</button>}
            </div>
          </details>}
          {combat?.kind === 'uma' && <div className="space-y-2" aria-label="Laser training">
            {state.squad.filter((outfit) => eligible(save, outfit)).map((outfit) => {
              const progress = trainingOf(save, outfit, shifted)
              return <div className="flex flex-wrap items-center gap-2" key={outfit}>
                <span className="text-sm font-semibold">{nameOf(pack, outfit)} · Laser {progress.rank}</span>
                {!shifted && <select className={action} aria-label={`Subclass for ${nameOf(pack, outfit)}`} value={progress.subclass ?? ''}
                  onChange={(event) => {
                    const choice = COMBAT_SUBCLASSES.find((key) => key === event.currentTarget.value) ?? null
                    void updateSave((current) => current.mission?.id === mission.id && current.mission.step === 'deploy'
                      ? chooseSubclass(current, outfit, choice) : current)
                  }}>
                  <option value="">No subclass</option>
                  {COMBAT_SUBCLASSES.map((key) => <option key={key} value={key}>{SUBCLASS_NAME[key]}</option>)}
                </select>}
                {!shifted && (progress.subclass === 'melee' || progress.subclass === 'shield') && <button type="button" className={action}
                  aria-pressed={!!alternateFit[outfit]} onClick={() => setAlternateFit({ ...alternateFit, [outfit]: !alternateFit[outfit] })}>
                  {alternateFit[outfit] ? progress.subclass === 'shield' ? 'Blade and shield' : 'Great blade' : 'Laser rifle'}
                </button>}
              </div>
            })}
            {ground?.expansion && <p className="text-sm">Mission gear · {PARTS_BY_ID.get(ground.expansion)?.name}</p>}
          </div>}
          {!combat && fitted && <div className="flex flex-wrap gap-2" aria-label="Rig for this sortie">
            <button type="button" className={action} aria-pressed={useFitted} onClick={() => setUseFitted(true)}>Use fitted rig</button>
            <button type="button" className={action} aria-pressed={!useFitted} onClick={() => setUseFitted(false)}>Use issued kit</button>
          </div>}
          {!combat && (fitted && useFitted ? <p className="text-sm text-cyan-200">{fittedSummary(fitted)}</p> : <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="space-y-2"><legend className="text-sm text-white/70">Main weapon</legend>
              {weapons.map((option) => <button key={option.id} type="button" aria-pressed={main === option.id}
                className={`${action} block w-full text-left aria-pressed:ring-2 aria-pressed:ring-cyan-300`} onClick={() => setMain(option.id)}>
                {option.name} <span className="font-normal text-white/70">· {option.details}</span>
              </button>)}
            </fieldset>
            {ground?.expansion ? <div className="space-y-2">
              <p className="text-sm text-white/70">Required armor expansion</p>
              <p className="font-semibold">{PARTS_BY_ID.get(ground.expansion)?.name}</p>
            </div> : <fieldset className="space-y-2"><legend className="text-sm text-white/70">Armor expansion</legend>
              {expansions.map((option) => <button key={option.id} type="button" aria-pressed={expansion === option.id}
                className={`${action} block w-full text-left aria-pressed:ring-2 aria-pressed:ring-cyan-300`} onClick={() => setExpansion(option.id)}>
                {option.name} <span className="font-normal text-white/70">· {option.details}</span>
              </button>)}
            </fieldset>}
          </div>)}
          {deploymentError && <p role="alert" className="text-sm text-red-300">{deploymentError}</p>}
          <div className="flex gap-2">
            <button type="button" className={primary} onClick={() => {
              setLaunching(true)
              setDeploymentError(null)
              void updateSave((s) => {
                if (s.mission?.step !== 'deploy' || s.mission.id !== mission.id) return s
                if (combat) {
                  const ready = !!combatShift && s.story.flags.includes(combatShift)
                  if (combat.kind === 'combined' && !formationReady(s, combat, ready, ashore)) throw new Error('The assigned formation is unavailable.')
                  const outfits = s.mission.squad.filter((outfit) => eligible(s, outfit))
                  const input = specialistInput({ scenario, combat, save: s, story: pack, outfits, shifted: ready,
                    alternate: alternateFit, expansion: ground?.expansion, boss: ground?.boss })
                  const squad = input.units.flatMap((unit) => unit.side === 'squad' && unit.ref?.kind === 'uma' ? [Number(unit.ref.id)] : [])
                  return deploy(setSquad(s, squad), editableSquad ? lifeAboardInput(input, s, () => null) : input)
                }
                const companions = s.mission.squad.slice(1).filter((outfit) => eligible(s, outfit)).flatMap((outfit) => {
                  const member = s.crew.find((candidate) => candidate.outfit === outfit)
                  return member ? [{ outfit, label: nameOf(pack, outfit), rig: member.rig }] : []
                })
                const rig = fitted && useFitted
                  ? fittedGroundRig(s.crew.find(({ outfit }) => outfit === trainee)?.rig, scenario, ground?.expansion) : null
                if (fitted && useFitted && !rig) return s
                const input = groundInput(scenario, trainee, label, main, ground?.expansion ?? expansion, ground?.boss, companions, rig ?? undefined)
                const squad = input.units.flatMap((unit) => unit.side === 'squad' && unit.ref?.kind === 'uma' ? [Number(unit.ref.id)] : [])
                return deploy(setSquad(s, squad), editableSquad ? lifeAboardInput(input, s, () => null) : input)
              }).catch((error: unknown) => setDeploymentError(error instanceof Error ? error.message : 'Deployment unavailable.'))
                .finally(() => setLaunching(false))
            }}>Deploy</button>
            <button type="button" className={action} onClick={close}>Campaign</button>
          </div>
        </>}
        {state.step === 'results' && <div className="flex gap-2">
          {state.won ? <button type="button" className={primary} onClick={() => void updateSave(ground ? (s) => settleGround(s, ground, pack) : settleTraining)}>Debrief</button>
            : <button type="button" className={primary} onClick={() => void updateSave(retry)}>Retry</button>}
          <button type="button" className={action} onClick={close}>Campaign</button>
        </div>}
      </div>
    </main>
  )
}

function GroundBattle({ layout, input, actions, close, mission, portrait, interior, title, combatSprites }: {
  layout: StageLayout; input: BattleInput; actions: BattleAction[]; close: () => void; mission: string; portrait?: { url: string; unit: string }; interior: boolean; title?: string
  combatSprites?: CampaignRelease['combatSprites']
}) {
  const [session] = useState(() => resume(input, actions))
  if ('error' in session) return <div className={panel} style={insets}>
    <p role="alert">The battle can’t resume.</p>
    <button type="button" className={primary} onClick={() => void updateSave((save) => toDeploy(retry(save)))}>Prepare again</button>
  </div>
  const objectiveLabel = title ? `Objective · ${title}` : input.objective.kind === 'hack' ? input.objective.count > 1 ? 'Objective · Disconnect both consoles' : 'Objective · Secure manifest console'
    : input.objective.kind === 'defeatLeader' ? 'Objective · Subdue the commander' : undefined
  return <BattleView layout={layout} session={session} control={{ squad: 'player', enemy: 'ai' }} debug={false} training combatSprites={combatSprites ?? []} portrait={portrait} objectiveLabel={objectiveLabel}
    standInKit={interior ? 'town' : undefined}
    onCommit={(next) => {
      const action = next.actions.at(-1)
      if (action) void updateSave((save) => save.mission?.step === 'battle' && save.mission.id === mission ? recordAction(save, action) : save, { quiet: true })
    }}
    onEnd={(next) => void updateSave((save) => save.mission?.step === 'battle' && save.mission.id === mission ? finishBattle(save, next.state.result?.winner === 'squad') : save)}
    onQuit={close} />
}
