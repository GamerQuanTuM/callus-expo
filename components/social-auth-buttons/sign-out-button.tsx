import React from 'react'
import { Button } from 'react-native'
import { type Router, useRouter } from 'expo-router'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

async function onSignOutButtonPress(router: Router, queryClient: QueryClient) {
  queryClient.clear()
  
  const { error } = await supabase.auth.signOut()
  if (!error) {
    router.replace('/(auth)/login')
  }

  if (error) {
    console.error('Error signing out:', error)
  }
}

export default function SignOutButton() {
  const router = useRouter()
  const queryClient = useQueryClient()
  
  return (
    <Button 
      title="Sign out" 
      onPress={() => onSignOutButtonPress(router, queryClient)} 
    />
  )
}
