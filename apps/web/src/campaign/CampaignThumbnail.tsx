import type { CampaignReleaseFile } from '@cyber/domain'
import { useEffect, useState } from 'react'
import { campaignImage } from './load'

export function CampaignThumbnail({ asset, className }: { asset?: CampaignReleaseFile; className: string }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    setUrl(undefined)
    if (!asset) return
    let live = true
    let image: string | undefined
    void campaignImage(asset).then((result) => {
      if (!live) return URL.revokeObjectURL(result)
      image = result
      setUrl(result)
    }, () => {})
    return () => { live = false; if (image) URL.revokeObjectURL(image) }
  }, [asset])
  return url ? <img src={url} alt="" className={className} /> : null
}
