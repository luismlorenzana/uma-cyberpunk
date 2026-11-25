# Sprite Art handoff for Cyberpunk palette batches

Use the complete-animation format for the live campaign. Start from a locally approved Character, Boss or Lieutenant template with the same body, visible gear, pose set and foot pivot as its intended variants. Keep one Boss album per identity across story roles. Give each actor their own versioned Combat Sprites album entry.

## Author a batch

1. Select an approved template version. Pin its bundle and placement SHA-256 hashes. Inspect its four quarter views and every fitting you plan to reuse. Use the actual assigned gear and matching silhouette for each target.
2. Choose the target swatches from that actor’s approved armor reference. Map exact source RGB values to the target shades. Include the ramp from highlight to shadow where needed. Where an exact source color also occurs on protected details, supply a hash-pinned, same-size black-and-white atlas mask. White allows changes. With a mask list, pages absent from the list stay at their source colors.
3. Keep the existing silhouette, anchors, weapon contact, and animation cues. Send a different armor form or loadout for source art when those details change. Image generation is reserved for those geometry exceptions.
4. Run the exporter once for the approved batch. It writes draft cels, atlases, placements, a contact sheet for each actor and a receipt with their exact hashes. Use the contact sheets and representative playback to review the batch. Check ears, markings, visor, shield, Back gear and poses wherever color masks intersect.
5. Apply the existing local Art approval workflow to exact selected versions and add them to the corresponding actor albums. Return the selected paths, owner approval and the bundle, placement and page SHA-256 pins. Include numeric outfit IDs for crew and stable board IDs, forms, story roles and actual hand or Back assignments for bosses and lieutenants. Engineering uses those pins for Platform and the four-act campaign publication.

## Run the exporter

From the game checkout, use a private recipe and a fresh output directory.

```pwsh
node --import tsx scripts/art/export-complete-sprite-recolors.ts content/sprite-palette-batch/recipe.json content/sprite-palette-batch/drafts-v001
```

Recipe example with synthetic names. Supply real SHA-256 values from the approved template and keep the recipe and resulting files in private content.

```json
{
  "schemaVersion": 1,
  "templates": [
    {
      "id": "sealed-rifle",
      "directory": "approved-source/v001",
      "manifestSha256": "<bundle.json SHA-256>",
      "placementsSha256": "<asset-placements.json SHA-256>"
    }
  ],
  "actors": [
    {
      "category": "characters",
      "character": "example-officer",
      "version": "v002",
      "template": "sealed-rifle",
      "sets": [
        {
          "source": "sealed-rifle-ready",
          "id": "rifle",
          "label": "Laser rifle",
          "colors": { "#486779": "#78526e", "#7ea4af": "#b288a5" }
        }
      ]
    }
  ]
}
```

Use category `characters`, `bosses` or `lieutenants`. Recipe paths resolve beside the recipe. Each set may include `masks` keyed by source atlas page ID, with `file` and `sha256` per mask. The exporter rejects unused swatches and invalid masks. The output stays draft until Art approves it. The producer records the approved bundle and game bindings before publishing.

## Definition of done

Every selected actor has an approved palette, matching template and complete versioned album bundle. The source alpha and frames keep their original dimensions and geometry. Playback matches the reference timing. Approved palette changes are reproducible from the exact recipe and template. The game handoff names any actor who needs new silhouette, hand contact or equipment art.
