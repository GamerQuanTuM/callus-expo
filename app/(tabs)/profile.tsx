import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList, Dimensions, ActivityIndicator } from 'react-native'
import React, { useState } from 'react'
import { Video, ResizeMode } from 'expo-av'
import SignOutButton from '@/components/social-auth-buttons/sign-out-button'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getProfile, getUserVideos } from '@/lib/api'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const NUM_COLUMNS = 2
const VIDEO_SIZE = (SCREEN_WIDTH - 4) / NUM_COLUMNS

interface UserProfile {
    id: string;
    email: string;
    username: string;
    fullname: string;
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
    user_id: string;
    created_at: string;
    user: UserProfile;
}

const Profile = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [authUserId, setAuthUserId] = useState<string | null>(null);

    React.useEffect(() => {
        const getAuthUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setAuthUserId(user?.id || null);
        };
        getAuthUser();
    }, []);

    // Fetch user profile data
    const { data: user, isLoading } = useQuery({
        queryKey: ['userProfile'],
        queryFn: async (): Promise<UserProfile | null> => {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) return null

            const data = await getProfile({ id: authUser.id }) as UserProfile
            return data
        },
    })

    const { data: videos, isLoading: videosLoading } = useQuery({
        queryKey: ['userVideos', user?.id],
        queryFn: ({ queryKey }) => {
            const [, userId] = queryKey;
            if (!userId) return [];
            return getUserVideos({ id: userId });
        },
        enabled: !!user?.id,
    })

    // Calculate real stats from videos data
    const userStats = React.useMemo(() => {
        if (!videos) return null;

        const videosCount = videos.length;
        const totalLikes = videos.reduce((sum, video) => sum + video.likes, 0);
        const totalViews = videos.reduce((sum, video) => sum + video.views, 0);

        return {
            videosCount,
            totalLikes,
            totalViews
        };
    }, [videos]);

    const formatNumber = (num: number): string => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    };

    const stats = [
        {
            label: 'Videos',
            value: userStats ? formatNumber(userStats.videosCount) : '0',
            icon: 'videocam-outline'
        },
        {
            label: 'Likes',
            value: userStats ? formatNumber(userStats.totalLikes) : '0',
            icon: 'heart-outline'
        },
        {
            label: 'Views',
            value: userStats ? formatNumber(userStats.totalViews) : '0',
            icon: 'eye-outline'
        },
    ]

    const renderVideoItem = ({ item, index }: { item: DanceVideo; index: number }) => (
        <TouchableOpacity
            style={[
                styles.videoItem,
                index % NUM_COLUMNS !== NUM_COLUMNS - 1 && styles.videoItemRightSpacing
            ]}
            onPress={() => console.log('Open video:', item.id)}
        >
            <Video
                source={{ uri: item.video_url }}
                style={styles.videoThumbnail}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                isLooping
                isMuted={false}
            />
            <View style={styles.videoOverlay}>
                <View style={styles.videoStats}>
                    <Ionicons name="play" size={16} color="#fff" />
                    <Text style={styles.videoStatText}>{formatNumber(item.views)}</Text>
                </View>
                <View style={styles.videoStats}>
                    <Ionicons name="heart" size={16} color="#fff" />
                    <Text style={styles.videoStatText}>{formatNumber(item.likes)}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Loading Dance Videos...</Text>
                </View>
            </SafeAreaView>
        )
    }

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>User not found</Text>
                    <SignOutButton />
                </View>
            </SafeAreaView>
        )
    }

    const formatJoinDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long'
        })
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Profile</Text>
                </View>

                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View style={styles.avatarContainer}>
                        {user.avatar_url ? (
                            <Image
                                source={{ uri: user.avatar_url }}
                                style={styles.avatar}
                            />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Ionicons name="person" size={40} color="#666" />
                            </View>
                        )}
                        <TouchableOpacity style={styles.editAvatarButton}>
                            <Ionicons name="camera" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.fullname}>
                        {user.fullname || 'No Name Set'}
                    </Text>
                    <Text style={styles.username}>
                        @{user.username || 'username'}
                    </Text>
                    <Text style={styles.email}>
                        {user.email}
                    </Text>

                    <View style={styles.joinDateContainer}>
                        <Ionicons name="calendar-outline" size={16} color="#666" />
                        <Text style={styles.joinDate}>
                            Joined {formatJoinDate(user.created_at)}
                        </Text>
                    </View>
                </View>

                {/* Stats Section */}
                <View style={styles.statsSection}>
                    <Text style={styles.sectionTitle}>Stats</Text>
                    <View style={styles.statsGrid}>
                        {stats.map((stat, index) => (
                            <View key={stat.label} style={styles.statCard}>
                                <Ionicons
                                    name={stat.icon as any}
                                    size={24}
                                    color="#ff2e63"
                                />
                                <Text style={styles.statValue}>{stat.value}</Text>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Videos Grid Section */}
                <View style={styles.videosSection}>
                    <Text style={[styles.sectionTitle, { paddingHorizontal: 12, }]}>My Videos</Text>
                    {videosLoading ? (
                        <View style={styles.videosLoading}>
                            <Text style={styles.loadingText}>Loading videos...</Text>
                        </View>
                    ) : videos && videos.length > 0 ? (
                        <FlatList
                            data={videos}
                            renderItem={renderVideoItem}
                            keyExtractor={(item) => item.id}
                            numColumns={NUM_COLUMNS}
                            scrollEnabled={false}
                            contentContainerStyle={styles.videosGrid}
                        />
                    ) : (
                        <View style={styles.noVideosContainer}>
                            <Ionicons name="videocam-outline" size={64} color="#ccc" />
                            <Text style={styles.noVideosText}>No videos yet</Text>
                            <Text style={styles.noVideosSubtext}>
                                Start creating and sharing your dance videos!
                            </Text>
                        </View>
                    )}
                </View>

                {/* Sign Out Button */}
                <View style={styles.signOutSection}>
                    <SignOutButton />
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollView: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: '#666',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#666',
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        textAlign: 'center',
    },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editAvatarButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#ff2e63',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    fullname: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 4,
    },
    username: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    email: {
        fontSize: 14,
        color: '#999',
        marginBottom: 12,
    },
    joinDateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    joinDate: {
        fontSize: 14,
        color: '#666',
    },
    statsSection: {
        paddingVertical: 24,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statCard: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
        marginTop: 8,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
    },
    videosSection: {
        paddingVertical: 24,
        paddingHorizontal: 10,
    },
    videosGrid: {
        paddingHorizontal: 1, // Half of the gap to center the grid
    },
    videoItem: {
        width: VIDEO_SIZE,
        height: VIDEO_SIZE,
        marginBottom: 2,
        position: 'relative',
    },
    videoItemRightSpacing: {
        marginRight: 2,
    },
    videoThumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: '#f0f0f0',
    },
    videoOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    videoStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    videoStatText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    videosLoading: {
        padding: 40,
        alignItems: 'center',
    },
    noVideosContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    noVideosText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
    },
    noVideosSubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    signOutSection: {
        paddingVertical: 32,
        paddingHorizontal: 20,
    },
})

export default Profile