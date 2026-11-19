# Ship combat in the campaign

Prepare the four stations, allocate reactor power and choose an order. Launch pays its displayed
cargo cost once. The ship then resolves each order before showing its cinematic.

The Captain's order leads into the assigned officer's response, the action and its confirmed result.
The overlay keeps hull, shields, the protected craft and any emitter visible. **Skip to result**
shortens the sequence; **Fast orders** goes straight to the result. **Continue** returns to the same
allocation. The order log keeps the actor, target, allocation, damage and actual outcome.

Reload resumes the saved result without firing again. **Retry defense/approach** reuses the original
starting situation and launch payment. The officer and protected-craft names come from that launch,
even when a later content release replaces the pictures. Older battles without recorded identities
use **Watch officer**.

An emitter hit is distinct from an emitter disabled. Disabling it does not finish the approach;
winning and debriefing establish the boarding route. Boarding, custody and civilian handovers remain
their own campaign actions. A ship leaving the fight is not described as destroyed.

Optional mission, crew, retry and emitter reports use the existing campaign drafts and participants.
They spend nothing and grant no extra battle result. A missing officer or image has a factual fallback.
The first release reuses neutral portraits while final operating poses and combat art are authored.

See the [runtime contract](../technical/command-cinematics.md) for authoring bindings and verification.
