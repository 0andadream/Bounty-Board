import { Link } from 'react-router-dom'
import { GITHUB_REPO, PAY_MINIAPP_URL, X_URL } from '../lib/links.ts'
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
      <div className="site-foot-inner">
        <div className="site-foot-brand">
          <span className="brand-word">BOUNTY BOARD</span>
          <p>Post a task. Get paid in NIM.</p>
          <p>Built for Nimiq Mini Apps Competition</p>
        </div>
        <div>
          <p className="site-foot-head">Product</p>
          <Link to="/bounties">Board</Link>
          <Link to="/bounties?create=1">Post a bounty</Link>
          <Link to="/mine">Mine</Link>
          <a href={PAY_MINIAPP_URL} target="_blank" rel="noreferrer">
            Open in Nimiq Pay
          </a>
        </div>
        <div>
          <p className="site-foot-head">Docs</p>
          <Link to="/docs">How it works</Link>
          <Link to="/docs#pay">Pay in NIM</Link>
          <Link to="/docs#receipt">Receipts</Link>
          <Link to="/probe">Provider check</Link>
        </div>
        <div>
          <p className="site-foot-head">Legal</p>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <a href={`${GITHUB_REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
            MIT License
          </a>
        </div>
        <div>
          <p className="site-foot-head">Network</p>
          <a href={X_URL} target="_blank" rel="noreferrer">
            X
          </a>
          <a href={GITHUB_REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="https://nimiq.dev/mini-apps" target="_blank" rel="noreferrer">
            Nimiq Pay
          </a>
          <a href="https://miniappscompetition.com/" target="_blank" rel="noreferrer">
            Competition
          </a>
        </div>
      </div>
    </footer>
  )
}
