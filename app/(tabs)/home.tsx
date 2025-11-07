import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, ActivityIndicator, Pressable, Image } from 'react-native'
import React, { useEffect, useRef, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Video, ResizeMode } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDanceVideos, handleLikeDislike, updateViewCount } from '@/lib/api'
import { supabase } from '@/lib/supabase'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

interface User {
  id: string;
  username: string;
  fullname: string;
  email: string;
  avatar_url: string;
  created_at: string;
}

interface DanceVideo {
  id: string;
  title: string;
  description: string;
  category: string;
  video_url: string;
  views: number;
  likes: number;
  liked_by?: string[];
  user_id: string;
  created_at: string;
  user: User;
}

const Home = () => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set())
  const [viewedVideos, setViewedVideos] = useState<Set<string>>(new Set())
  const [paused, setPaused] = useState(false)
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false)
  const [user, setUser] = useState<any>(null)

  const flatListRef = useRef<FlatList>(null)
  const hideIconTimeoutRef = useRef<number | null>(null)
  const videoRefs = useRef<Record<string, Video | null>>({})

  const queryClient = useQueryClient()

  // Get user on component mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const { data: videos } = useQuery({
    queryKey: ['danceVideos'],
    queryFn: getDanceVideos,
  })

  // Initialize liked videos from the videos data
  useEffect(() => {
    if (videos && user) {
      const userLikedVideoIds = new Set(
        videos
          .filter(video => video.liked_by?.includes(user.id))
          .map(video => video.id)
      );
      setLikedVideos(userLikedVideoIds);
    }
  }, [videos, user]);

  // Like/Dislike mutation with FIXED optimistic updates
  const likeMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'like' | 'dislike' }) =>
      handleLikeDislike({ id, action }),
    onMutate: async ({ id, action }) => {
      if (!user) return;

      await queryClient.cancelQueries({ queryKey: ['danceVideos'] });
      const previousVideos = queryClient.getQueryData<DanceVideo[]>(['danceVideos']);

      // Store the current state for rollback
      const previousLikedState = likedVideos.has(id);

      // Optimistically update both likes count and liked_by array
      queryClient.setQueryData(['danceVideos'], (old: DanceVideo[] | undefined) => {
        if (!old) return old;
        return old.map(video => {
          if (video.id === id) {
            const currentLikedBy = video.liked_by || [];
            const isCurrentlyLiked = currentLikedBy.includes(user.id);
            
            // Only update if the action matches the current state
            if (action === 'like' && !isCurrentlyLiked) {
              return {
                ...video,
                likes: video.likes + 1,
                liked_by: [...currentLikedBy, user.id]
              };
            } else if (action === 'dislike' && isCurrentlyLiked) {
              return {
                ...video,
                likes: Math.max(0, video.likes - 1),
                liked_by: currentLikedBy.filter(uid => uid !== user.id)
              };
            }
          }
          return video;
        });
      });

      // Update local liked videos state
      setLikedVideos(prev => {
        const newSet = new Set(prev);
        if (action === 'like') {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
        return newSet;
      });

      return { previousVideos, previousLikedState };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousVideos) {
        queryClient.setQueryData(['danceVideos'], context.previousVideos);
      }
      
      // Revert local liked videos state on error
      setLikedVideos(prev => {
        const newSet = new Set(prev);
        // Use the stored previous state to determine what to do
        if (context?.previousLikedState !== undefined) {
          if (context.previousLikedState) {
            newSet.add(variables.id);
          } else {
            newSet.delete(variables.id);
          }
        }
        return newSet;
      });
    },
    onSettled: () => {
      // Refetch to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['danceVideos'] });
    },
  });

  // View count mutation with optimistic updates
  const viewMutation = useMutation({
    mutationFn: updateViewCount,
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['danceVideos'] });
      const previousVideos = queryClient.getQueryData<DanceVideo[]>(['danceVideos']);

      queryClient.setQueryData(['danceVideos'], (old: DanceVideo[] | undefined) => {
        if (!old) return old;
        return old.map(video =>
          video.id === id
            ? {
              ...video,
              views: video.views + 1
            }
            : video
        );
      });

      return { previousVideos };
    },
    onError: (err, variables, context) => {
      if (context?.previousVideos) {
        queryClient.setQueryData(['danceVideos'], context.previousVideos);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['danceVideos'] });
    }
  });

  useEffect(() => {
    if (!paused && showPlayPauseIcon) {
      if (hideIconTimeoutRef.current) {
        clearTimeout(hideIconTimeoutRef.current);
      }

      hideIconTimeoutRef.current = setTimeout(() => {
        setShowPlayPauseIcon(false);
      }, 1500) as unknown as number;
    }

    return () => {
      if (hideIconTimeoutRef.current) {
        clearTimeout(hideIconTimeoutRef.current);
      }
    };
  }, [paused, showPlayPauseIcon]);

  const handleLikeDislikePress = (videoId: string) => {
    if (!user) {
      // Handle unauthenticated user - you can show a login prompt here
      console.log('User not authenticated');
      return;
    }

    const isCurrentlyLiked = likedVideos.has(videoId);
    const action = isCurrentlyLiked ? 'dislike' : 'like';
    
    console.log(`Like action: ${action} for video ${videoId}`);
    likeMutation.mutate({ id: videoId, action });
  };

  const togglePlayPause = (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (!video) return;

    setPaused(prev => {
      const newPaused = !prev;

      setShowPlayPauseIcon(true);

      if (newPaused) {
        video.pauseAsync();
      } else {
        video.playAsync();
      }
      return newPaused;
    });
  };

  const handleVideoPress = (videoId: string) => {
    setShowPlayPauseIcon(true);
    togglePlayPause(videoId);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const currentVideoId = viewableItems[0].item.id;
      setCurrentIndex(viewableItems[0].index);
      setPaused(false);
      setShowPlayPauseIcon(true);

      setViewedVideos(prev => {
        const newSet = new Set(prev);
        if (!newSet.has(currentVideoId)) {
          newSet.add(currentVideoId);
          viewMutation.mutate({ id: currentVideoId });
        }
        return newSet;
      });
    }
  }).current;

  const renderVideoItem = ({ item, index }: { item: DanceVideo; index: number }) => {
    const isLiked = likedVideos.has(item.id);
    const isCurrent = index === currentIndex;

    return (
      <Pressable
        style={styles.videoContainer}
        onPress={() => handleVideoPress(item.id)}
      >
        <Video
          ref={ref => {
            videoRefs.current[item.id] = ref;
          }}
          source={{ uri: item.video_url }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isCurrent && !paused}
          isLooping
          isMuted={false}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          {showPlayPauseIcon && (
            <View style={styles.playPauseButton}>
              <Ionicons
                name={paused ? "play-circle-outline" : "pause-circle-outline"}
                size={64}
                color="white"
              />
            </View>
          )}

          {/* Video Info */}
          <View style={styles.bottomInfo}>
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <Image
                  source={{ uri: item.user.avatar_url }}
                  style={styles.avatar}
                />
                <Text style={styles.userName}>{item.user.fullname}</Text>
              </View>
              <Text style={styles.username}>@{item.user.username}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <View style={styles.stats}>
                <Ionicons name="eye-outline" size={16} color="white" />
                <Text style={styles.statsText}>{item.views}</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.rightActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleLikeDislikePress(item.id)}
              disabled={likeMutation.isPending || !user}
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={32}
                color={isLiked ? "#ff2e63" : "white"}
              />
              <Text style={styles.actionText}>
                {item.likes}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble-outline" size={30} color="white" />
              <Text style={styles.actionText}>Comment</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="share-social-outline" size={30} color="white" />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    );
  };

  if (!videos?.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading Dance Videos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: 16, 
    fontSize: 16, 
    color: 'white' 
  },
  videoContainer: { 
    height: SCREEN_HEIGHT, 
    width: '100%' 
  },
  video: { 
    flex: 1 
  },
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'flex-end' 
  },
  bottomInfo: { 
    padding: 16, 
    paddingBottom: 100 
  },
  userInfo: { 
    gap: 8 
  },
  userHeader: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  avatar: {
    width: 30, 
    height: 30, 
    borderRadius: 20 
  },
  userName: {
    fontSize: 18, 
    fontWeight: 'bold', 
    color: 'white', 
    textShadowColor: 'rgba(0,0,0,0.75)', 
    textShadowOffset: { width: -1, height: 1 }, 
    textShadowRadius: 10 
  },
  username: {
    fontSize: 16, 
    fontWeight: '400', 
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.75)', 
    textShadowOffset: { width: -1, height: 1 }, 
    textShadowRadius: 10
  },
  title: { 
    fontSize: 14, 
    color: 'white', 
    textShadowColor: 'rgba(0,0,0,0.75)', 
    textShadowOffset: { width: -1, height: 1 }, 
    textShadowRadius: 10 
  },
  stats: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4 
  },
  statsText: { 
    fontSize: 12, 
    color: 'white', 
    fontWeight: '600' 
  },
  rightActions: { 
    position: 'absolute', 
    right: 12, 
    bottom: 100, 
    gap: 24 
  },
  actionButton: { 
    alignItems: 'center', 
    gap: 4 
  },
  actionText: { 
    fontSize: 12, 
    color: 'white', 
    fontWeight: '600' 
  },
  playPauseButton: {
    position: 'absolute',
    top: '40%',
    left: '40%',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    padding: 8,
  },
});

export default Home;