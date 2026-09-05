import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { WalletProvider } from './context/WalletContext.tsx'
import { BoardScreen } from './screens/Board.tsx'
import { BountyDetail } from './screens/BountyDetail.tsx'
import { MyWork } from './screens/MyWork.tsx'
import { NewBounty } from './screens/NewBounty.tsx'
import { Probe } from './screens/Probe.tsx'
import { Receipt } from './screens/Receipt.tsx'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-root">
      <div className="app-frame">
        {children}
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Board
          </NavLink>
          <NavLink to="/new" className={({ isActive }) => (isActive ? 'active' : '')}>
            New
          </NavLink>
          <NavLink to="/mine" className={({ isActive }) => (isActive ? 'active' : '')}>
            My work
          </NavLink>
        </nav>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Shell>
                <BoardScreen />
              </Shell>
            }
          />
          <Route
            path="/new"
            element={
              <Shell>
                <NewBounty />
              </Shell>
            }
          />
          <Route
            path="/mine"
            element={
              <Shell>
                <MyWork />
              </Shell>
            }
          />
          <Route
            path="/b/:id"
            element={
              <Shell>
                <BountyDetail />
              </Shell>
            }
          />
          <Route
            path="/b/:id/receipt"
            element={
              <Shell>
                <Receipt />
              </Shell>
            }
          />
          <Route
            path="/probe"
            element={
              <Shell>
                <Probe />
              </Shell>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  )
}
