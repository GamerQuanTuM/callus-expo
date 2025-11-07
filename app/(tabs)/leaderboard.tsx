import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { getLeaderBoardDetails } from "@/lib/api"

type FilterType = 'weekly' | 'monthly' | 'allTime'

interface LeaderboardEntry {
  id: string
  rank: number
  score: number
  video: {
    user: {
      id: string
      username: string
      avatar_url?: string
      email: string
      fullname: string
    }
    likes: number
    views: number
    title: string
  }
}

const Leaderboard = () => {
  const [filter, setFilter] = useState<FilterType>('allTime')

  const { data: leaderboardData, isLoading, error } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: getLeaderBoardDetails
  })

  // Transform API data to match your component structure
  const transformedData = leaderboardData?.map((item, index) => ({
    id: item.id,
    rank: item.rank || index + 1,
    username: item.video?.user?.username || 'anonymous',
    fullname: item.video?.user?.fullname || 'anonymous',
    avatar_url: item.video?.user?.avatar_url,
    total_score: item.score,
    total_likes: item.video?.likes || 0,
    user_id: item.video?.user?.id
  })) || []

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return { icon: 'trophy', color: '#FFD700' }
      case 2:
        return { icon: 'trophy', color: '#C0C0C0' }
      case 3:
        return { icon: 'trophy', color: '#CD7F32' }
      default:
        return null
    }
  }

  const renderLeaderboardItem = ({ item, index }: { item: any; index: number }) => {
    const rankIcon = getRankIcon(item.rank)

    return (
      <TouchableOpacity style={styles.itemContainer}>
        <View style={styles.rankContainer}>
          {rankIcon ? (
            <Ionicons name={rankIcon.icon as any} size={28} color={rankIcon.color} />
          ) : (
            <Text style={styles.rankText}>#{item.rank}</Text>
          )}
        </View>

        <View style={styles.avatarContainer}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={24} color="#666" />
            </View>
          )}
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.fullname}>{item.fullname}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{item.total_score}</Text>
          <Text style={styles.scoreLabel}>pts</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const FilterButton = ({ type, label }: { type: FilterType; label: string }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === type && styles.filterButtonActive]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  )

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading Leaderboard...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="trophy" size={28} color="#FFD700" />
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ff2e63" />
          <Text style={styles.errorText}>Failed to load leaderboard</Text>
          <Text style={styles.errorSubtext}>Please try again later</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="trophy" size={28} color="#FFD700" />
        <Text style={styles.headerTitle}>Leaderboard</Text>
      </View>

      <View style={styles.filterContainer}>
        <FilterButton type="weekly" label="This Week" />
        <FilterButton type="monthly" label="This Month" />
        <FilterButton type="allTime" label="All Time" />
      </View>

      <FlatList
        data={transformedData}
        renderItem={renderLeaderboardItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No rankings yet</Text>
            <Text style={styles.emptySubtext}>Be the first to compete!</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
    color: '#000',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#ff2e63',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: 'white',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  avatarContainer: {
    marginLeft: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fullname: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },

  username: {
    fontSize: 12,
    fontWeight: '400',
    color: '#000',
    marginBottom: 2,
  },
  videoTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
  },
})

export default Leaderboard