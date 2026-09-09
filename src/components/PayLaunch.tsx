import { PAY_DEEP_LINK, PAY_WEB_LINK } from '../lib/links.ts'
import { shouldUseMiniApp } from '../providers/nimiq.ts'

export function payLaunchHref(): string {
  if (typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    return PAY_DEEP_LINK
  }
  return PAY_WEB_LINK
}

export function OpenInNimiqPay({ className = 'btn-ghost no-underline' }: { className?: string }) {
  if (typeof window !== 'undefined' && shouldUseMiniApp()) return null
  return (
    <a className={className} href={payLaunchHref()}>
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
        <a href={PAY_DEEP_LINK}>Open in Nimiq Pay</a>
      </p>
      <p className="site-foot-deep">{PAY_DEEP_LINK}</p>
      <p>Built for Nimiq Mini Apps Competition</p>
    </footer>
  )
}
