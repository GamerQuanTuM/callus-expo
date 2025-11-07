/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
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
  Image,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDebounce } from "use-debounce";
import { checkEmailExists, checkUsernameExists, createUser, signUp, uploadToStorage } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useMutation } from "@tanstack/react-query";
import { PRIMARY_BG } from "@/constants/color";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-z_]+$/, "Username can only contain lowercase letters and underscores"),
  fullname: z.string().min(3, "Username must be at least 3 characters"),
  avatar_url: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function Register() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);



  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setError,
    reset,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      username: "",
      fullname: "",
      avatar_url: "",
    },
    mode: "onChange",
  });

  const username = watch("username");
  const email = watch("email");

  const [debouncedUsername] = useDebounce(username, 600);
  const [debouncedEmail] = useDebounce(email, 600);

  // Pick avatar image
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Allow gallery access to choose an avatar.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking avatar:", error);
      Alert.alert("Error", "Failed to pick avatar");
    }
  };

  // Supabase signup mutation
  const registerMutation = useMutation({
    mutationFn: async (data: FormData) => {
      let avatarUrl = data.avatar_url;

      // Handle avatar upload if avatarUri exists
      if (avatarUri) {
        setUploading(true);
        try {
          avatarUrl = await uploadToStorage({
            uri: avatarUri, bucket: "avatars", folder: data.email
          });
        } catch (uploadError: any) {
          console.error('Avatar upload error:', uploadError);
          throw new Error(`Avatar upload failed: ${uploadError.message}`);
        } finally {
          setUploading(false);
        }
      }

      // Create auth user
      const { data: authData, error: authError } = await signUp({
        avatar_url: avatarUrl,
        email: data.email,
        password: data.password,
        username: data.username,
        fullname: data.fullname,
      })


      if (authError) throw authError;

      // Create user profile in public.users table
      if (authData.user) {
        const { error: profileError } = await createUser({
          id: authData.user.id,
          email: data.email,
          username: data.username,
          avatar_url: avatarUrl,
          fullname: data.fullname,
        })

        if (profileError) {
          console.error('Profile creation error:', profileError);

          // Optional: Clean up auth user if profile creation fails
          await supabase.auth.admin.deleteUser(authData.user.id);

          throw new Error('Failed to create user profile');
        }
      }

      return authData;
    },
    onSuccess: (authData) => {
      if (authData.user) {
        Alert.alert(
          'Success!',
          'Account created successfully! Please check your email for verification.',
          [
            {
              text: 'OK',
              onPress: () => router.push('/(tabs)/home'),
            },
          ]
        );
        reset();
      }
    },
    onError: (error: any) => {
      console.error('Registration error:', error);

      // Handle specific error cases
      if (error.message.includes('Avatar upload failed')) {
        Alert.alert('Upload Error', error.message);
      } else if (error.message.includes('user_already_exists')) {
        setError('email', { message: 'An account with this email already exists' });
      } else if (error.message.includes('password')) {
        setError('password', { message: 'Password does not meet requirements' });
      } else if (error.message.includes('email')) {
        setError('email', { message: 'Please enter a valid email address' });
      } else if (error.message.includes('Failed to create user profile')) {
        Alert.alert(
          'Profile Error',
          'Account created but profile setup failed. Please try logging in.'
        );
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    },
  });

  useEffect(() => {
    const checkAvailability = async () => {
      if (debouncedUsername && debouncedUsername.length >= 3) {
        try {
          const exists = await checkUsernameExists({ username: debouncedUsername });
          if (exists) {
            setError("username", { message: "This username is already taken" });
          }
        } catch (err) {
          console.error("Username check error:", err);
        }
      }
    };
    checkAvailability();
  }, [debouncedUsername]);

  useEffect(() => {
    const checkAvailability = async () => {
      if (debouncedEmail && debouncedEmail.includes("@")) {
        try {
          const exists = await checkEmailExists({ email: debouncedEmail });
          if (exists) {
            setError("email", { message: "This email is already registered" });
          }
        } catch (err) {
          console.error("Email check error:", err);
        }
      }
    };
    checkAvailability();
  }, [debouncedEmail]);

  const onSubmit = (data: FormData) => {
    if (!registerMutation.isPending) {
      registerMutation.mutate({ ...data, avatar_url: avatarUri || "" });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.innerContainer}>
          {/* Header */}
          <Animated.View entering={FadeInUp.duration(1000).springify()} style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Create Account</Text>
            <Text style={styles.headerSubtitle}>Join Us!!!</Text>
          </Animated.View>

          {/* Avatar Picker */}
          <Animated.View entering={FadeInDown.duration(1000).delay(100).springify()} style={styles.avatarContainer}>
            <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrapper}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera-outline" size={40} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.avatarText}>
              {avatarUri ? "Tap to change avatar" : "Add Profile Picture"}
            </Text>
          </Animated.View>

          {/* Username */}
          <Animated.View entering={FadeInDown.duration(1000).delay(200).springify()} style={styles.inputBlock}>
            <Text style={styles.label}>Username</Text>
            <Controller
              control={control}
              name="username"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.username && styles.inputError]}
                  placeholder="Enter your username"
                  placeholderTextColor="#fff9"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.username && <Text style={styles.errorText}>{errors.username.message}</Text>}
          </Animated.View>

          {/* Fullname */}
          <Animated.View entering={FadeInDown.duration(1000).delay(200).springify()} style={styles.inputBlock}>
            <Text style={styles.label}>Fullname</Text>
            <Controller
              control={control}
              name="fullname"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.username && styles.inputError]}
                  placeholder="Enter your fullname"
                  placeholderTextColor="#fff9"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.fullname && <Text style={styles.errorText}>{errors.fullname.message}</Text>}
          </Animated.View>

          {/* Email */}
          <Animated.View entering={FadeInDown.duration(1000).delay(300).springify()} style={styles.inputBlock}>
            <Text style={styles.label}>Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="Enter your email"
                  placeholderTextColor="#fff9"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
          </Animated.View>

          {/* Password */}
          <Animated.View entering={FadeInDown.duration(1000).delay(400).springify()} style={styles.inputBlock}>
            <Text style={styles.label}>Password</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#fff9"
                    secureTextEntry={!showPassword}
                    onChangeText={onChange}
                    value={value}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
          </Animated.View>

          {/* Register Button */}
          <Animated.View entering={FadeInDown.duration(1000).delay(600).springify()}>
            <TouchableOpacity
              onPress={handleSubmit(onSubmit)}
              disabled={!isValid || registerMutation.isPending || uploading}
              style={[styles.button, (!isValid || registerMutation.isPending) && styles.buttonDisabled]}
            >
              {registerMutation.isPending || uploading ? (
                <ActivityIndicator color="#f97316" />
              ) : (
                <Text style={styles.buttonText}>Register</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
          {/* Login Link */}
          <Animated.View
            entering={FadeInDown.duration(1000).delay(700).springify()}
            style={styles.loginLinkContainer}
          >
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PRIMARY_BG },
  scrollContainer: { flexGrow: 1 },
  innerContainer: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  headerContainer: { alignItems: "center", marginBottom: 32 },
  headerTitle: { color: "#fff", fontSize: 40, fontWeight: "bold", marginBottom: 8 },
  headerSubtitle: { color: "#fff", fontSize: 22, fontWeight: "600" },
  avatarContainer: { alignItems: "center", marginBottom: 24 },
  avatarWrapper: { width: 120, height: 120, borderRadius: 60, overflow: "hidden", borderWidth: 2, borderColor: "#fff" },
  avatarImage: { width: "100%", height: "100%" },
  avatarPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  avatarText: { color: "#fff", marginTop: 8, fontSize: 14 },
  inputBlock: { marginBottom: 16 },
  label: { color: "#fff", marginBottom: 8, fontSize: 14, fontWeight: "600" },
  input: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: "#fff",
    fontSize: 16,
  },
  inputError: { borderWidth: 1, borderColor: "#f87171" },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  passwordInput: { flex: 1, color: "#fff", fontSize: 16, paddingVertical: 16 },
  button: { backgroundColor: "#fff", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginBottom: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#f97316", fontWeight: "bold", fontSize: 18 },
  errorText: { color: "#fecaca", fontSize: 13, marginTop: 4, marginLeft: 8 },
  loginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  loginText: {
    color: "#fff",
  },
  loginLink: {
    color: "#fff",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});
