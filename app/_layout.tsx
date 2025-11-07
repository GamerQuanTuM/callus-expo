import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AuthProvider from "@/providers/auth-provider";
import { useAuthContext } from "@/hooks/use-auth-context";
import { SplashScreenController } from "@/components/splash-screen-controller";
import TanstackProvider from "@/providers/tanstack-provider";
import { PRIMARY_BG } from "@/constants/color";

function RootNavigator() {
  const { isLoggedIn, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: PRIMARY_BG,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/register" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <TanstackProvider>
      <AuthProvider>
        <SplashScreenController />
        <RootNavigator />
        <StatusBar style="light" />
      </AuthProvider>
    </TanstackProvider>
  )
}
