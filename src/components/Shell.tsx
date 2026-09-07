import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { shortWallet } from '../lib/format.ts'
import { shouldUseMiniApp } from '../providers/nimiq.ts'
import { goBack } from './BackKey.tsx'
import { Avatar } from './ui.tsx'

export function Shell() {
  const wallet = useWallet()
  const profile = useProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const connected = wallet.nimiqAddress || wallet.ethAddress
  const chipWallet = wallet.nimiqAddress ?? wallet.ethAddress ?? 'board'
  const home = shouldUseMiniApp() ? '/bounties' : '/'

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' && event.key !== 'Backspace') return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('.modal-back')) return
      if (location.pathname === '/') return
      if (event.key === 'Backspace') event.preventDefault()
      goBack(navigate)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [location.pathname, navigate])

  return (
    <div className="app-root">
      <div className="shell">
        <header className="topbar">
          <NavLink to={home} className="brand" aria-label="Bounty Board">
            <span className="brand-word">BOUNTY BOARD</span>
          </NavLink>
          <nav className="top-links">
            <NavLink to="/bounties">
              Bounties
            </NavLink>
            <NavLink to="/mine">Mine</NavLink>
          </nav>
          <div className="topbar-end">
            {connected ? (
              <>
                <span className="addr hidden sm:inline text-muted">
                  {wallet.nimiqAddress
                    ? shortWallet('NIM', wallet.nimiqAddress)
                    : shortWallet('USDT', wallet.ethAddress!)}
                </span>
                <button type="button" className="btn-ghost" onClick={wallet.disconnect}>
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-accent"
                title={wallet.error ?? 'Connect wallet'}
                onClick={() => void wallet.connect().catch(() => undefined)}
              >
                {wallet.status === 'connecting' ? 'Connecting…' : (
                  <>
                    Connect<span className="hidden sm:inline"> wallet</span>
                  </>
                )}
              </button>
            )}
            <NavLink to="/profile" className="profile-chip" aria-label="Profile settings" title="Profile">
              <Avatar profile={profile.me} wallet={chipWallet} />
            </NavLink>
          </div>
        </header>
        {wallet.error && !connected ? (
          <p className="m-0 px-4 py-2 text-center text-[12px]" style={{ color: '#fb7185' }}>
            {wallet.error}
          </p>
        ) : null}
        <Outlet />
      </div>
    </div>
  )
}
