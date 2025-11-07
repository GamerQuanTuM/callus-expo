import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native'
import React, { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Video, ResizeMode } from 'expo-av'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { generateAIContent, saveDanceVideo, uploadToStorage } from '@/lib/api'
import { PRIMARY_BG } from '@/constants/color'

interface VideoUploadData {
  videoUri: string
  title: string
  description: string
  category: string
}

const CATEGORIES = ['Hip Hop', 'Ballet', 'Contemporary', 'Jazz', 'Freestyle', 'Latin']

const UploadScreen = () => {
  const queryClient = useQueryClient()
  const [videoUri, setVideoUri] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [generatingTitle, setGeneratingTitle] = useState(false)
  const [generatingDescription, setGeneratingDescription] = useState(false)

  // AI Content Generation Mutation
  const aiMutation = useMutation({
    mutationFn: generateAIContent,
    onSuccess: (data: { type: string, result: string, success: boolean }) => {
      if (data.success) queryClient.invalidateQueries({ queryKey: ['danceVideos'] })
      if (data.type === "title") {
        setTitle(data.result)
        setGeneratingTitle(false)
      } else {
        setDescription(data.result)
        setGeneratingDescription(false)
      }
      Alert.alert('AI Content Generated', 'Your content has been created!')
    },
    onError: (error) => {
      setGeneratingTitle(false)
      setGeneratingDescription(false)
      Alert.alert('Error', 'Failed to generate AI content',)
    }
  })

  // Request permissions
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera roll permissions to upload videos.'
      )
      return false
    }
    return true
  }

  // Pick video from gallery
  const pickVideo = async () => {
    const hasPermission = await requestPermissions()
    if (!hasPermission) return

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
        videoMaxDuration: 60,
      })

      if (!result.canceled && result.assets[0]) {
        setVideoUri(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Error picking video:', error)
      Alert.alert('Error', 'Failed to pick video')
    }
  }

  // Record video with camera
  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera permissions to record videos.'
      )
      return
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
        videoMaxDuration: 60,
      })

      if (!result.canceled && result.assets[0]) {
        setVideoUri(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Error recording video:', error)
      Alert.alert('Error', 'Failed to record video')
    }
  }

  const generateAIDescription = async () => {
    if (!selectedCategory) {
      Alert.alert('Missing Category', 'Please select a category to generate a description from AI')
      return
    }

    setGeneratingDescription(true)
    aiMutation.mutate({
      prompt: selectedCategory,
      type: "description"
    })
  }

  const generateAITitle = () => {
    if (!selectedCategory) {
      Alert.alert('Missing Category', 'Please select a category to generate a title from AI')
      return
    }

    setGeneratingTitle(true)
    aiMutation.mutate({
      prompt: selectedCategory,
      type: "title"
    })
  }

  const handleUpload = () => {
    // Validation
    if (!videoUri) {
      Alert.alert('No Video', 'Please select or record a video first')
      return
    }

    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your video')
      return
    }

    if (!selectedCategory) {
      Alert.alert('Missing Category', 'Please select a category')
      return
    }

    // Confirm upload
    Alert.alert(
      'Upload Video',
      'Are you ready to share your dance with the world?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload',
          onPress: () => {
            setUploading(true)
            uploadMutation.mutate({
              videoUri,
              title,
              description,
              category: selectedCategory,
            })
          },
        },
      ]
    )
  }

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: VideoUploadData) => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not authenticated')

        let videoUrl = data.videoUri

        // Upload video to storage
        try {
          videoUrl = await uploadToStorage({
            uri: videoUrl,
            bucket: "dance-videos",
            type: "video",
            folder: user.id
          })
          console.log('Video uploaded:', videoUrl)
        } catch (uploadError: any) {
          console.error('Video upload error:', uploadError)
          throw new Error(`Video upload failed: ${uploadError.message}`)
        }

        // Save video metadata to database
        const videoData = await saveDanceVideo({
          id: user.id,
          video_url: videoUrl,
          title: data.title,
          description: data.description,
          category: data.category,
        })

        return videoData
      } catch (error) {
        console.error('Upload mutation error:', error)
        throw error
      }
    },
    onSuccess: () => {
      // Invalidate and refetch videos
      queryClient.invalidateQueries({ queryKey: ['danceVideos'] })
      queryClient.invalidateQueries({ queryKey: ['userVideos'] })

      // Reset form
      setVideoUri(null)
      setTitle('')
      setDescription('')
      setSelectedCategory('')
      setUploading(false)

      Alert.alert(
        'Success!',
        'Your video has been uploaded successfully!',
        [{ text: 'OK' }]
      )
    },
    onError: (error: any) => {
      setUploading(false)
      console.error('Full upload error:', error)
      Alert.alert('Upload Failed', error.message || 'Failed to upload video')
    },
  })

  const removeVideo = () => {
    Alert.alert('Remove Video', 'Are you sure you want to remove this video?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setVideoUri(null),
      },
    ])
  }

  // Check if upload button should be disabled
  const isUploadButtonDisabled = uploading || uploadMutation.isPending || generatingTitle || generatingDescription

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="cloud-upload-outline" size={28} color={PRIMARY_BG} />
          <Text style={styles.headerTitle}>Upload Dance Video</Text>
        </View>

        {/* Video Preview or Upload Options */}
        {!videoUri ? (
          <View style={styles.uploadOptionsContainer}>
            <Text style={styles.sectionTitle}>Choose Video Source</Text>

            <TouchableOpacity style={styles.uploadOption} onPress={pickVideo}>
              <View style={styles.uploadIconContainer}>
                <Ionicons name="images-outline" size={32} color={PRIMARY_BG} />
              </View>
              <View style={styles.uploadOptionText}>
                <Text style={styles.uploadOptionTitle}>Gallery</Text>
                <Text style={styles.uploadOptionSubtitle}>
                  Choose from your videos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadOption} onPress={recordVideo}>
              <View style={styles.uploadIconContainer}>
                <Ionicons name="videocam-outline" size={32} color={PRIMARY_BG} />
              </View>
              <View style={styles.uploadOptionText}>
                <Text style={styles.uploadOptionTitle}>Record</Text>
                <Text style={styles.uploadOptionSubtitle}>
                  Record a new video
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#999" />
              <Text style={styles.infoText}>
                Videos should be 15-60 seconds long and in vertical format (9:16)
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.videoPreviewContainer}>
            <Text style={styles.sectionTitle}>Video Preview</Text>
            <View style={styles.videoWrapper}>
              <Video
                source={{ uri: videoUri }}
                style={styles.videoPreview}
                resizeMode={ResizeMode.COVER}
                isLooping
                shouldPlay
              />
              <TouchableOpacity style={styles.removeButton} onPress={removeVideo}>
                <Ionicons name="close-circle" size={32} color={PRIMARY_BG} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Upload Form (shown when video is selected) */}
        {videoUri && (
          <View style={styles.formContainer}>
            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title *</Text>
              <View style={styles.textAreaContainer}>
                <TextInput
                  style={[styles.input, styles.textArea, {
                    height: 80,
                  }]}
                  placeholder="Give your video a catchy title"
                  placeholderTextColor="#666"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={100}
                />
                <TouchableOpacity
                  style={[
                    styles.aiButtonFloating,
                    generatingTitle && styles.aiButtonDisabled
                  ]}
                  onPress={generateAITitle}
                  disabled={generatingTitle}
                >
                  {generatingTitle ? (
                    <ActivityIndicator size="small" color={PRIMARY_BG} />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={16} color={PRIMARY_BG} />
                      <Text style={styles.aiButtonText}>AI</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.charCount}>{title.length}/100</Text>
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <View style={styles.textAreaContainer}>
                <TextInput
                  style={[styles.input, styles.textArea, {
                    height: 120,
                  }]}
                  placeholder="Tell us about your dance..."
                  placeholderTextColor="#666"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[
                    styles.aiButtonFloating,
                    generatingDescription && styles.aiButtonDisabled
                  ]}
                  onPress={generateAIDescription}
                  disabled={generatingDescription}
                >
                  {generatingDescription ? (
                    <ActivityIndicator size="small" color={PRIMARY_BG} />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={16} color={PRIMARY_BG} />
                      <Text style={styles.aiButtonText}>AI</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.charCount}>{description.length}/500</Text>
            </View>

            {/* Category Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category *</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryChip,
                      selectedCategory === category && styles.categoryChipActive,
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        selectedCategory === category && styles.categoryTextActive,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Upload Button */}
            <TouchableOpacity
              style={[
                styles.uploadButton,
                isUploadButtonDisabled && styles.uploadButtonDisabled,
              ]}
              onPress={handleUpload}
              disabled={isUploadButtonDisabled}
            >
              {uploading || uploadMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={24} color="white" />
                  <Text style={styles.uploadButtonText}>Upload Video</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Guidelines */}
            <View style={styles.guidelines}>
              <Text style={styles.guidelinesTitle}>Upload Guidelines:</Text>
              <View style={styles.guidelineItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.guidelineText}>
                  Keep videos between 15-60 seconds
                </Text>
              </View>
              <View style={styles.guidelineItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.guidelineText}>
                  Use vertical format (9:16 aspect ratio)
                </Text>
              </View>
              <View style={styles.guidelineItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.guidelineText}>Ensure good lighting and audio</Text>
              </View>
              <View style={styles.guidelineItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.guidelineText}>
                  Follow community guidelines
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  uploadOptionsContainer: {
    marginTop: 24,
  },
  uploadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  uploadIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 46, 99, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  uploadOptionText: {
    flex: 1,
  },
  uploadOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  uploadOptionSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  videoPreviewContainer: {
    marginTop: 24,
  },
  videoWrapper: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoPreview: {
    width: '100%',
    height: 400,
    backgroundColor: '#000',
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
  },
  formContainer: {
    marginTop: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  textArea: {
    textAlignVertical: 'top',
    paddingRight: 50,
  },
  textAreaContainer: {
    position: 'relative',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryChipActive: {
    backgroundColor: PRIMARY_BG,
    borderColor: PRIMARY_BG,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  categoryTextActive: {
    color: 'white',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_BG,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  guidelines: {
    marginTop: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginBottom: 12,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  guidelineText: {
    fontSize: 14,
    color: '#999',
    flex: 1,
  },
  aiButtonFloating: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 46, 99, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    minWidth: 40,
    justifyContent: 'center',
  },
  aiButtonDisabled: {
    opacity: 0.6,
  },
  aiButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_BG,
  },
})

export default UploadScreen