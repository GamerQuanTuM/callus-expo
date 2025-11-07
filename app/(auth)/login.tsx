import React, { useState } from "react";
import { useRouter } from "expo-router";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PRIMARY_BG } from "@/constants/color";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setError,
    reset,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onChange",
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
      return authData;
    },
    onSuccess: (authData) => {
      if (authData.user) {
        Alert.alert("Success!", "Logged in successfully!", [
          {
            text: "OK",
            onPress: () => {
              queryClient.invalidateQueries({ queryKey: ["user"] });
              router.push("/(tabs)/home");
            },
          },
        ]);
        reset();
      }
    },
    onError: (error: any) => {
      console.error("Login error:", error);
      if (
        error.message.includes("email") ||
        error.message.includes("Invalid login credentials")
      ) {
        setError("email", { message: "Invalid email or password" });
        setError("password", { message: "Invalid email or password" });
      } else if (error.message.includes("password")) {
        setError("password", { message: error.message });
      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    },
  });

  const onSubmit = (data: LoginFormData) => {
    if (!loginMutation.isPending) {
      loginMutation.mutate(data);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerContainer}>
          {/* Header */}
          <Animated.View
            entering={FadeInUp.duration(1000).springify()}
            style={styles.headerContainer}
          >
            <Text style={styles.headerText}>Welcome</Text>
            <Text style={styles.headerText}>Back</Text>
          </Animated.View>

          {/* Email Input */}
          <Animated.View
            entering={FadeInDown.duration(1000).delay(200).springify()}
            style={styles.inputBlock}
          >
            <Text style={styles.label}>Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Enter your email"
                    placeholderTextColor="#fff9"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[
                      styles.input,
                      errors.email && styles.inputError,
                    ]}
                  />
                  {errors.email && (
                    <Text style={styles.errorText}>{errors.email.message}</Text>
                  )}
                </View>
              )}
            />
          </Animated.View>

          {/* Password Input */}
          <Animated.View
            entering={FadeInDown.duration(1000).delay(400).springify()}
            style={styles.inputBlock}
          >
            <Text style={styles.label}>Password</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <>
                  <View
                    style={[
                      styles.passwordContainer,
                      errors.password && styles.inputError,
                    ]}
                  >
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Enter your password"
                      placeholderTextColor="#fff9"
                      secureTextEntry={!showPassword}
                      style={styles.passwordInput}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off" : "eye"}
                        size={24}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.password && (
                    <Text style={styles.errorText}>
                      {errors.password.message}
                    </Text>
                  )}
                </>
              )}
            />
          </Animated.View>

          {/* Forgot Password */}
          <Animated.View
            entering={FadeInDown.duration(1000).delay(500).springify()}
            style={styles.forgotContainer}
          >
            <TouchableOpacity>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Login Button */}
          <Animated.View
            entering={FadeInDown.duration(1000).delay(600).springify()}
          >
            <TouchableOpacity
              onPress={handleSubmit(onSubmit)}
              disabled={!isValid || loginMutation.isPending}
              style={[
                styles.button,
                (!isValid || loginMutation.isPending) && styles.buttonDisabled,
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {loginMutation.isPending ? "Signing In..." : "Login"}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Register Link */}
          <Animated.View
            entering={FadeInDown.duration(1000).delay(700).springify()}
            style={styles.registerContainer}
          >
            <Text style={styles.registerText}>
              Don&apos;t have an account?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY_BG
  },
  scrollContainer: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  headerText: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "bold",
  },
  inputBlock: {
    marginBottom: 16,
  },
  label: {
    color: "#fff",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: "#fff",
    fontSize: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: "#f87171",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 16,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 13,
    marginTop: 4,
    marginLeft: 8,
  },
  forgotContainer: {
    alignItems: "flex-end",
    marginBottom: 32,
  },
  forgotText: {
    color: "#fff",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#f97316",
    fontWeight: "bold",
    fontSize: 18,
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  registerText: {
    color: "#fff",
  },
  registerLink: {
    color: "#fff",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});
