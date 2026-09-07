import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell.tsx'
import { ProfileProvider } from './context/ProfileContext.tsx'
import { WalletProvider } from './context/WalletContext.tsx'
import { BoardScreen } from './screens/Board.tsx'
import { BountyDetail } from './screens/BountyDetail.tsx'
import { Landing } from './screens/Landing.tsx'
import { MyWork } from './screens/MyWork.tsx'
import { Probe } from './screens/Probe.tsx'
import { ProfileScreen } from './screens/Profile.tsx'
import { PublicProfile } from './screens/PublicProfile.tsx'
import { Receipt } from './screens/Receipt.tsx'

export default function App() {
  return (
    <WalletProvider>
      <ProfileProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route element={<Shell />}>
              <Route path="/bounties" element={<BoardScreen />} />
              <Route path="/new" element={<Navigate to="/bounties?create=1" replace />} />
              <Route path="/mine" element={<MyWork />} />
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path="/u/:username" element={<PublicProfile />} />
              <Route path="/b/:id" element={<BountyDetail />} />
              <Route path="/b/:id/receipt" element={<Receipt />} />
              <Route path="/probe" element={<Probe />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ProfileProvider>
    </WalletProvider>
  )
}
