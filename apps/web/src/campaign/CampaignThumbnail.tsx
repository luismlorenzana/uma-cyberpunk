import type { CampaignReleaseFile } from '@cyber/domain'
import { useEffect, useRef, useState } from 'react'
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

export function CampaignAvatar({ asset, name, className }: { asset?: CampaignReleaseFile; name: string; className: string }) {
  const frame = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!frame.current || !asset || visible) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '100px' })
    observer.observe(frame.current)
    return () => observer.disconnect()
  }, [asset, visible])
  return <span ref={frame} aria-hidden="true" data-campaign-avatar className={`relative grid shrink-0 place-items-center overflow-hidden bg-[#24364d] text-xs font-bold text-slate-300 ${className}`}>
    {name.trim().charAt(0)}
    <CampaignThumbnail asset={visible ? asset : undefined} className="absolute inset-0 size-full bg-[#24364d] object-cover object-top" />
  </span>
}
