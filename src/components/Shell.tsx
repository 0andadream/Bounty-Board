import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.tsx'
import { useWallet } from '../context/WalletContext.tsx'
import { shortWallet } from '../lib/format.ts'
import { Avatar } from './ui.tsx'
import { Logo } from './Logo.tsx'

function goBack(navigate: ReturnType<typeof useNavigate>) {
  if (window.history.length > 1) navigate(-1)
  else navigate('/')
}

export function Shell() {
  const wallet = useWallet()
  const profile = useProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const connected = wallet.nimiqAddress || wallet.ethAddress
  const chipWallet = wallet.nimiqAddress ?? wallet.ethAddress ?? 'board'
  const canGoBack = location.pathname !== '/'

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' && event.key !== 'Backspace') return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('.modal-back')) return
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
          {canGoBack ? (
            <button
              type="button"
              className="back-key"
              aria-label="Go back"
              title="Go back (Esc)"
              onClick={() => goBack(navigate)}
            >
              ← Back
            </button>
          ) : null}
          <NavLink to="/" className="brand" aria-label="Board">
            <Logo className="brand-logo" />
            <span className="brand-word">BOARD</span>
          </NavLink>
          <nav className="top-links">
            <NavLink to="/" end>
              Bounties
            </NavLink>
            <NavLink to="/mine">My work</NavLink>
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
        <Outlet />
      </div>
    </div>
  )
}
