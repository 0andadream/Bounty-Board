import { PAY_MINIAPP_URL } from '../lib/links.ts'
import { shouldUseMiniApp } from '../providers/nimiq.ts'

export function payLaunchHref(): string {
  return PAY_MINIAPP_URL
}

export function OpenInNimiqPay({ className = 'btn-ghost no-underline' }: { className?: string }) {
  if (typeof window !== 'undefined' && shouldUseMiniApp()) return null
  return (
    <a className={className} href={payLaunchHref()} target="_blank" rel="noreferrer">
      Open in Nimiq Pay
    </a>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <span className="brand-word">BOUNTY BOARD</span>
      <p>
        MIT ·{' '}
        <a href="https://github.com/0andadream/Bounty-Board" target="_blank" rel="noreferrer">
          GitHub
        </a>
        {' · '}
        <a href={PAY_MINIAPP_URL} target="_blank" rel="noreferrer">
          Open in Nimiq Pay
        </a>
      </p>
      <p>Built for Nimiq Mini Apps Competition</p>
    </footer>
  )
}
