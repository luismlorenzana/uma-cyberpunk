# Six-look campaign wardrobe (CY65–CY67)

The combined Tier 1–5 campaign uses all fifty officers' six approved neutral looks. The wardrobe is
presentation data in the private campaign book. Viewing it changes no save; save v19 and all existing
quest, recruitment, relationship, inventory and battle inputs remain compatible.

## Context and explicit staging

| Context | Default look |
|---|---|
| Shore/world | `street` |
| Public ship, off-duty spot, ordinary welcome/briefing | `ship-casual` |
| Private cabin, confession, seated evening, bed, morning | `quarters` |
| Active bridge/station/post | `pilot` |
| Equipped ground mission | `armor` |
| Explicit sealed mission | `armor-helmet` |

A supported `scene.look` wins over the context. A dock's world/place ID does not establish whether
the conversation is ashore. The private scene/context matrix is reviewed against Story's setting and
activity. The delivered sign-ons retain explicit operational Pilot staging; public off-watch scenes
use Ship Casual. Suit changes do not change dialogue, effects, choices, rewards or unlocks.

## Two consumers

The original app reads `looks/index.json` through its authenticated content client. It accepts six
roles, excludes splashes/categories, and matches the existing master-data character identity.
Quarters' Profile tab offers six read-only outfit buttons. Ordinary dialogue honors explicit looks,
then caller/known-place context. Cabin conversations default to Quarters; public ship conversations
default to Ship Casual. Older five-role indexes fall back from Ship Casual to Quarters, then the
existing master-data bust. The index refreshes on entry after thirty seconds; immutable image paths
remain cacheable. Each mounted image owns and releases its blob URL.

The campaign uses exact numeric identities and asset IDs rather than character-name matching.
Recruitment's Crew Stories cards expose a read-only Wardrobe only for recruited members. Scene
portraits and command actor base/profile/fallback bindings use the reviewed campaign mapping.
Missing derived portraits try their native master, then the scene's previous neutral, then the
ordinary bust. A fallback never receives another base's face placements.

## Private book format

`campaign.json.wardrobe` is optional. Old books retain their existing art. All IDs below are synthetic.

```json
{
  "members": [{
    "speaker": 9000001,
    "looks": {
      "street": { "asset": "officer-street" },
      "ship-casual": { "asset": "officer-casual", "dialogue": "officer-casual-dialogue", "profile": "officer-casual-profile" },
      "quarters": { "asset": "officer-quarters" },
      "pilot": { "asset": "officer-pilot" },
      "armor": { "asset": "officer-armor" },
      "armor-helmet": { "asset": "officer-helmet" }
    }
  }],
  "scenes": [{ "scene": "public-conversation", "context": "ship" }],
  "crops": [{
    "base": "officer-casual", "width": 1024, "height": 1536,
    "dialogue": { "asset": "officer-casual-dialogue", "left": 210, "top": 0, "width": 604, "height": 851 },
    "profile": { "asset": "officer-casual-profile", "left": 256, "top": 0, "size": 512 }
  }]
}
```

Each member declares all six roles. The parser checks playable identities, assets, scenes, contexts,
uniqueness, crop bounds and matching consumer IDs. Crop outputs cannot recursively source another
crop. Profiles export at 192 × 192 WebP; dialogue retains the cropped native pixels as lossless WebP.
Native approved images remain unchanged. Recipes describe framing, not a newly approved pose.

`wardrobeSceneArt` maps the neutral talking portrait and profile for that scene's role. A composition
layer follows the wardrobe only when it is a declared neutral-master placeholder. Bespoke seated,
bed, operating and attack poses remain separate. Whole-image emotes from a different outfit are
withheld; matching expression crops retain their speaker/base association. Neutral and derived
wardrobe bases are valid expression targets only for their declared speaker.

## Publication and replacement

The private registry now binds 300 identity/role combinations. Each has one native master plus a
dialogue and profile consumer. New roles, asset definitions, recipes and scene routing ship in the
reviewed content migration after deploying the compatible reader. The art-only publisher continues
to fingerprint all scripts, gameplay, wardrobe routing and recipes; it cannot perform that migration.

Afterward, ordinary approved-source pushes update Platform first and the game second. Replacing a
native master regenerates its declared dialogue/profile crops. A dimension change requires a reviewed
recipe migration. Existing native or derived face placements require the matching expression recipe
in the same push. The publisher translates new placements into dialogue-crop coordinates and rejects
faces outside the crop. It preserves native placements for existing consumers. Identical publication
does not upload images or move the selected pointer; scoped receipts exclude unrelated future assets.

See the [publisher runbook](campaign-art-publishing.md) for immutable staging, source verification,
generation preconditions and rollback. All approved hashes, selectors, crop provenance, scene routing,
Story adapters and release receipts remain in ignored authoring handoffs and the shared register.

## Acceptance and remaining authoring

The integrated candidate verifies 300 approved neutral masters, 600 mechanical crops and all 46
approved general-art sources. Its nineteen management locations retain all forty-six visual slots;
Fuel/Provisions props follow independent stock and protected local offers. The original 559 story
files retain their scripts; only reviewed scene-look fields change. Gameplay gates and save v19 stay
the same. The fifty sign-ons were replayed through their actual campaign prerequisites.

Phone-size Chrome at 844 × 390 with safe areas verifies both portrait consumers, early/later cohorts,
the real public conversation, read-only wardrobe and stock depletion. Physical installed-iPhone
acceptance remains CY37. Neutral wardrobe completion does not finish CY49/CY55 poses or expression
approval. [CY68 and CY69's first approved cohort](campaign-art-intake.md) are integrated; the remaining
CY69 setting/reuse work is integrated through the [complete environment delivery](campaign-environments.md). Ten reusable general cutouts, including the strike, have a precise
Platform-family extension request; campaign-local publication does not imply
that they are in a shared Platform gallery or atlas.
