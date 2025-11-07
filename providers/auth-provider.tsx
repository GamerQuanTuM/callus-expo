import React, { PropsWithChildren, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext } from '@/hooks/use-auth-context'
import { supabase } from '@/lib/supabase'

export default function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profile, setProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const fetchSession = async () => {
      setIsLoading(true)
      const { data: { session: gotSession }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error fetching session:', error)
      }
      setSession(gotSession)
      setIsLoading(false)
    }
    fetchSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // console.log('Auth change:', _event, newSession)
      setSession(newSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session) {
        setProfile(null)
        return
      }
      setIsLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      setProfile(data)
      setIsLoading(false)
    }
    fetchProfile()
  }, [session])

  const isLoggedIn = !!session  // or `session != null && session.user != null`

  return (
    <AuthContext.Provider value={{
        session,
        isLoading,
        profile,
        isLoggedIn
    }}>
      {children}
    </AuthContext.Provider>
  )
}
