// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

interface Video {
  id: string;
  title: string;
  likes: number;
  views: number;
  user_id: string;
  users?: {
    username: string | null;
    avatar_url: string | null;
  };
}

interface UserScore {
  user_id: string;
  username: string;
  avatar_url: string | null;
  best_video_id: string;
  best_video_title: string;
  score: number;
  likes: number;
  views: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Calculate score for a video based on views and likes
 * Score formula: (likes * 0.7 + views * 0.3) normalized to 0-100
 */
function calculateScore(likes: number, views: number, maxLikes: number, maxViews: number): number {
  // Avoid division by zero
  const normalizedLikes = maxLikes > 0 ? (likes / maxLikes) : 0;
  const normalizedViews = maxViews > 0 ? (views / maxViews) : 0;

  // Weighted score: 70% likes, 30% views
  const score = (normalizedLikes * 0.7 + normalizedViews * 0.3) * 100;

  // Ensure score is between 0 and 100
  return Math.min(Math.max(Math.round(score), 0), 100);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("Starting leaderboard update...");

    // Fetch all videos with their likes, views, and user info
    const { data: videos, error: fetchError } = await supabase
      .from('videos')
      .select(`
        id, 
        title, 
        likes, 
        views,
        user_id,
        users:user_id (
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error("Error fetching videos:", fetchError);
      throw fetchError;
    }

    if (!videos || videos.length === 0) {
      console.log("No videos found to process");
      return new Response(
        JSON.stringify({
          message: "No videos found",
          updated: 0
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    console.log(`Found ${videos.length} videos to process`);

    // Find max values for normalization
    const maxLikes = Math.max(...videos.map((v: Video) => v.likes || 0), 1);
    const maxViews = Math.max(...videos.map((v: Video) => v.views || 0), 1);

    console.log(`Max likes: ${maxLikes}, Max views: ${maxViews}`);

    // Calculate scores for all videos
    const videoScores = videos.map((video: Video) => ({
      video_id: video.id,
      user_id: video.user_id,
      title: video.title,
      username: video.users?.username || 'Anonymous',
      avatar_url: video.users?.avatar_url || null,
      score: calculateScore(video.likes || 0, video.views || 0, maxLikes, maxViews),
      likes: video.likes || 0,
      views: video.views || 0,
    }));

    // Group videos by user and find each user's best performing video
    const userBestVideos = new Map<string, UserScore>();

    videoScores.forEach((video) => {
      const existingUser = userBestVideos.get(video.user_id);

      // If user doesn't exist or this video has a better score, update it
      if (!existingUser || video.score > existingUser.score || 
          (video.score === existingUser.score && video.likes > existingUser.likes)) {
        userBestVideos.set(video.user_id, {
          user_id: video.user_id,
          username: video.username,
          avatar_url: video.avatar_url,
          best_video_id: video.video_id,
          best_video_title: video.title,
          score: video.score,
          likes: video.likes,
          views: video.views,
        });
      }
    });

    console.log(`Found ${userBestVideos.size} unique users`);

    // Convert to array and sort by score
    const userRankings = Array.from(userBestVideos.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // If scores are equal, sort by likes
      if (b.likes !== a.likes) return b.likes - a.likes;
      // If likes are equal, sort by views
      return b.views - a.views;
    });

    // Assign ranks to users (storing only video_id since leaderboard table doesn't have user_id)
    const leaderboardEntries = userRankings.map((user, index) => ({
      video_id: user.best_video_id,
      score: user.score,
      rank: index + 1,
      created_at: new Date().toISOString(),
    }));

    console.log("Calculated leaderboard entries:", leaderboardEntries.length);

    // Clear existing leaderboard entries
    const { error: deleteError } = await supabase
      .from('leaderboard')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error("Error clearing leaderboard:", deleteError);
      throw deleteError;
    }

    console.log("Cleared existing leaderboard entries");

    // Insert new leaderboard entries
    const { error: insertError } = await supabase
      .from('leaderboard')
      .insert(leaderboardEntries);

    if (insertError) {
      console.error("Error inserting leaderboard entries:", insertError);
      throw insertError;
    }

    console.log("Successfully updated leaderboard");

    // Get top 10 users with their details for response
    const top10 = userRankings.slice(0, 10).map((user, index) => ({
      rank: index + 1,
      user_id: user.user_id,
      username: user.username,
      avatar_url: user.avatar_url,
      best_video_id: user.best_video_id,
      best_video_title: user.best_video_title,
      score: user.score,
      likes: user.likes,
      views: user.views,
    }));

    return new Response(
      JSON.stringify({
        message: "Leaderboard updated successfully",
        updated: leaderboardEntries.length,
        total_users: userBestVideos.size,
        timestamp: new Date().toISOString(),
        top10: top10,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    console.error("Error updating leaderboard:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});

/* To invoke locally:
  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:
  
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/update-leaderboard' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{}'

  For production:
  curl -i --location --request POST 'https://your-project.supabase.co/functions/v1/update-leaderboard' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{}'
*/