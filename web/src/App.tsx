import React, { useState } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import Upload from './pages/Upload'
import Manual from './pages/Manual'
import Triage from './pages/Triage'
import History from './pages/History'
import Login from './pages/Login'
import ChatBot from './components/ChatBot'
import { SignedIn, SignedOut, useUser, SignInButton, UserButton } from '@clerk/clerk-react'
import ClerkSync from './components/ClerkSync'

export default function App() {
  const { isLoaded, isSignedIn, user } = useUser()
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const location = useLocation()
  
  // Auth disable flag for local/dev usage
  const DISABLE_AUTH = (import.meta as any).env.VITE_DISABLE_AUTH === 'true'
  
  // Hide chatbot on triage page to avoid duplicate interfaces
  // When auth is disabled, allow chatbot even if not signed in
  const shouldShowChatbot = (DISABLE_AUTH || isSignedIn) && location.pathname !== '/triage'

  function RequireAuth({ children }: { children: React.ReactNode }) {
    if (DISABLE_AUTH) return <>{children}</>
    if (!isLoaded) return <div className="container">Loading...</div>
    if (!isSignedIn) return <Navigate to="/login" replace />
    return <>{children}</>
  }

  // For the login route, render a clean full-page layout without nav so
  // the Clerk sign-in card can be perfectly centered on the viewport.
  if (location.pathname === '/login') {
    return (
      <main className="min-h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="w-full max-w-md flex items-center justify-center">
          <Login />
        </div>
      </main>
    )
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">
          <div className="brand-title">MediSense</div>
        </div>
        <div className="nav-links">
          <Link to="/upload" className="nav-link">Upload</Link>
          <Link to="/manual" className="nav-link">Manual</Link>
          <Link to="/history" className="nav-link">History</Link>
          <Link to="/triage" className="nav-link">Dr. Intelligence</Link>
          <SignedOut>
            <SignInButton />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </nav>
      <main className="container">
        <ClerkSync>
          <Routes>
            <Route
              path="/"
              element={
                DISABLE_AUTH
                  ? <Navigate to="/upload" replace />
                  : (isSignedIn ? <Navigate to="/upload" replace /> : <Navigate to="/login" replace />)
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/upload" element={<RequireAuth><Upload /></RequireAuth>} />
            <Route path="/manual" element={<RequireAuth><Manual /></RequireAuth>} />
            <Route path="/triage" element={<RequireAuth><Triage /></RequireAuth>} />
            <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
          </Routes>
        </ClerkSync>
      </main>
      
      {/* Floating Chatbot Button */}
      {shouldShowChatbot && (
        <button
          className="floating-chatbot-btn"
          onClick={() => setIsChatbotOpen(true)}
          aria-label="Open AI Health Assistant"
        >
          <svg className="chatbot-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      )}
      
      {/* Chatbot Modal */}
      {shouldShowChatbot && (
        <ChatBot
          isOpen={isChatbotOpen}
          onClose={() => setIsChatbotOpen(false)}
          userData={(() => {
            try {
              const latest = JSON.parse(localStorage.getItem('latest_result') || '{}')
              return {
                name: user?.fullName || user?.firstName || 'User',
                email: user?.emailAddresses?.[0]?.emailAddress || '',
                task: latest.task || 'general',
                features: latest.features || {},
                prediction: latest.prediction || null,
                lifestyle: latest.lifestyle || {},
                symptoms: latest.symptoms || {},
                extracted_text: latest.extracted_text || '',
                highlights: latest.highlights || []
              }
            } catch {
              return {
                name: user?.fullName || user?.firstName || 'User',
                email: user?.emailAddresses?.[0]?.emailAddress || '',
                task: 'general',
                features: {},
                prediction: null,
                lifestyle: {},
                symptoms: {}
              }
            }
          })()}
        />
      )}
    </div>
  )
}
