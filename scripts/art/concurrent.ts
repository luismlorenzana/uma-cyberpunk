/** Bound cloud traffic and settle every started worker before reporting a failed publication. */
export async function concurrent<T>(items: readonly T[], work: (item: T) => Promise<void>, limit = 6): Promise<void> {
  let at = 0
  const results = await Promise.allSettled(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (at < items.length) await work(items[at++]!)
  }))
  const failed = results.find((row): row is PromiseRejectedResult => row.status === 'rejected')
  if (failed) throw failed.reason
}
