import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Shell } from './components/Shell.tsx'
import { ProfileProvider } from './context/ProfileContext.tsx'
import { WalletProvider } from './context/WalletContext.tsx'
import { shouldUseMiniApp } from './providers/nimiq.ts'
import { BoardScreen } from './screens/Board.tsx'
import { BountyDetail } from './screens/BountyDetail.tsx'
import { Landing } from './screens/Landing.tsx'
import { MyWork } from './screens/MyWork.tsx'
import { Probe } from './screens/Probe.tsx'
import { ProfileScreen } from './screens/Profile.tsx'
import { PublicProfile } from './screens/PublicProfile.tsx'
import { Receipt } from './screens/Receipt.tsx'

function RootRoute() {
  const navigate = useNavigate()
  const [inPay, setInPay] = useState(() => shouldUseMiniApp())

  useEffect(() => {
    let tries = 0
    let timer = 0
    function check() {
      if (shouldUseMiniApp()) {
        setInPay(true)
        navigate('/bounties', { replace: true })
        return
      }
      if (tries++ < 50) timer = window.setTimeout(check, 100)
    }
    check()
    return () => window.clearTimeout(timer)
  }, [navigate])

  if (inPay) return <Navigate to="/bounties" replace />
  return <Landing />
}

function FallbackRoute() {
  return <Navigate to={shouldUseMiniApp() ? '/bounties' : '/'} replace />
}

export default function App() {
  return (
    <WalletProvider>
      <ProfileProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route element={<Shell />}>
              <Route path="/bounties" element={<BoardScreen />} />
              <Route path="/board" element={<Navigate to="/bounties" replace />} />
              <Route path="/new" element={<Navigate to="/bounties?create=1" replace />} />
              <Route path="/mine" element={<MyWork />} />
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path="/u/:username" element={<PublicProfile />} />
              <Route path="/b/:id" element={<BountyDetail />} />
              <Route path="/b/:id/receipt" element={<Receipt />} />
              <Route path="/probe" element={<Probe />} />
              <Route path="*" element={<FallbackRoute />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ProfileProvider>
    </WalletProvider>
  )
}
