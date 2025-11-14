import React, { useEffect } from 'react'
import { SignedOut, SignedIn, SignIn, useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { isSignedIn } = useUser()
  const navigate = useNavigate()
  const DISABLE_AUTH = (import.meta as any).env.VITE_DISABLE_AUTH === 'true'

  useEffect(() => {
    if (DISABLE_AUTH) {
      navigate('/upload', { replace: true })
      return
    }
    if (isSignedIn) {
      navigate('/upload', { replace: true })
    }
  }, [DISABLE_AUTH, isSignedIn, navigate])

  if (DISABLE_AUTH) {
    return <div>Redirecting...</div>
  }

  return (
    <div className="shadow-2xl rounded-2xl overflow-hidden w-full">
      <SignedOut>
        <SignIn afterSignInUrl="/upload" />
      </SignedOut>
      <SignedIn />
    </div>
  )
}
