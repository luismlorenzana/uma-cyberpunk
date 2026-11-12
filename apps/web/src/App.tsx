// The placeholder page (CY1): the game's name in uma-kit's theme. CY3 brings the real shell; no stage renders yet, so
// three.js stays out of the bundle.
export function App() {
  return (
    <main className="min-h-dvh grid place-items-center bg-[var(--color-bg,#0f1620)] text-[var(--color-ink,#e8eef5)]">
      <h1 className="text-3xl font-semibold tracking-tight">uma-cyberpunk</h1>
    </main>
  )
}
