import React from "react";
import { useRouter } from "expo-router";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export default function Index() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* App Title */}
      <Animated.View entering={FadeInUp.duration(1000).springify()} style={styles.header}>
        <Text style={styles.title}>Tiktik</Text>
        <Text style={styles.subtitle}>Welcome to your dance reels app</Text>
      </Animated.View>

      {/* Login Button */}
      <Animated.View entering={FadeInDown.duration(1000).delay(200).springify()} style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => router.push("/(auth)/login")}
          style={[styles.button, styles.primaryButton]}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Login</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Register Button */}
      <Animated.View entering={FadeInDown.duration(1000).delay(400).springify()} style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => router.push("/(auth)/register")}
          style={[styles.button, styles.secondaryButton]}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Register</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f97316", // orange-500
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 64,
  },
  title: {
    color: "#fff",
    fontSize: 56,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    marginBottom: 16,
  },
  button: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#201d1d",
  },
  primaryButtonText: {
    color: "#f97316",
    fontSize: 18,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 2,
    borderColor: "#fff",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
