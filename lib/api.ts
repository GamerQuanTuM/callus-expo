import { readAsStringAsync } from "expo-file-system/legacy";
import { supabase } from "./supabase";

export const uploadToStorage = async (
    { uri, bucket, type = "image", folder = "" }: { uri: string; bucket: "dance-videos" | "avatars"; type?: "image" | "video", folder?: string; }
): Promise<string> => {
    if (!uri) throw new Error("No file selected");

    const fileExt = uri.split(".").pop()?.toLowerCase();
    if (!fileExt) throw new Error("Invalid file extension");

    let validExtensions: string[];
    let contentType: string;

    if (type === "video") {
        validExtensions = ["mp4", "mov", "avi", "mkv"];
        if (!validExtensions.includes(fileExt)) {
            throw new Error("Please select a valid video file (MP4, MOV, AVI, MKV)");
        }
        contentType = `video/${fileExt === "mov" ? "quicktime" : fileExt}`;
    } else if (type === "image") {
        validExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
        if (!validExtensions.includes(fileExt)) {
            throw new Error("Please select a valid image file (JPG, PNG, GIF, WebP)");
        }
        contentType = `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;
    } else {
        throw new Error("Invalid file type. Only 'image' or 'video' are supported.");
    }

    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // Read file as base64
    const fileData = await readAsStringAsync(uri, { encoding: "base64" });

    // Convert base64 → Uint8Array
    const binaryString = atob(fileData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Validate file size (max 40MB for videos, 5MB for images)
    const maxSize = type === "video" ? 40 * 1024 * 1024 : 5 * 1024 * 1024;
    if (bytes.length > maxSize) {
        throw new Error(type === "video" ? "Video size must be less than 40MB" : "Image size must be less than 5MB");
    }

    // Upload
    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, bytes, {
            contentType,
            cacheControl: "3600",
            upsert: false,
        });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

    if (!data?.publicUrl) throw new Error("Failed to get public URL");

    return data.publicUrl;
};

export const signUp = async function ({ email, password, username, avatar_url, fullname }: { email: string, password: string, username: string, avatar_url?: string, fullname: string }) {
    return await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username,
                avatar_url,
                fullname,
            },
        },
    });
}

export const createUser = async ({ id, email, username, avatar_url, fullname }: { id: string, email: string, username: string, avatar_url?: string, fullname: string }) => {
    return await supabase
        .from('users')
        .insert([
            {
                id,
                email,
                username,
                avatar_url,
                fullname,
            },
        ])
        .select()
        .single();
}

export const checkUsernameExists = async ({ username }: { username: string }) => {
    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();

    if (error) throw error;
    return !!data;
};


export const checkEmailExists = async ({ email }: { email: string }) => {
    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

    if (error) throw error;
    return !!data;
};

export const saveDanceVideo = async ({ id, video_url, title, description, category }: { id: string, video_url: string, title: string, description: string, category: string }) => {
    const { data: videoData, error } = await supabase
        .from('videos')
        .insert([
            {
                user_id: id,
                video_url,
                title,
                description,
                category,
                likes: 0,
                views: 0,
                created_at: new Date().toISOString(),
            },
        ])
        .select()
        .single()

    if (error) throw error
    return videoData
}

export const generateAIContent = async ({ prompt, type }: { prompt: string, type: "title" | "description" }) => {
    const response = await fetch(`https://${process.env.EXPO_PUBLIC_PROJECT_REF}.supabase.co/functions/v1/generate-content-from-ai`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.EXPO_PUBLIC_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
            prompt,
            type
        })
    })

    const data = await response.json()
    return data

}

export const getDanceVideos = async () => {
    const { data, error } = await supabase
        .from('videos')
        .select(`*,user:users (*)`)
        .order('created_at', { ascending: false });

    if (error) throw error
    return data
}

// Prevent race condition
export const handleLikeDislike = async ({
  id,
  action
}: {
  id: string;
  action: 'like' | 'dislike';
}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    console.log(`API: ${action} video ${id} for user ${user.id}`);

    if (action === 'like') {
      const { data, error } = await supabase
        .rpc('like_video', { 
          video_id_param: id,
        user_id_param: user.id
        });
      
      if (error) {
        console.error('Like RPC error:', error);
        throw error;
      }
      console.log('Like RPC success:', data);
    } else {
      const { data, error } = await supabase
        .rpc('unlike_video', { 
          video_id_param: id, 
          user_id_param: user.id
        });
      
      if (error) {
        console.error('Unlike RPC error:', error);
        throw error;
      }
      console.log('Unlike RPC success:', data);
    }
  } catch (error) {
    console.error('handleLikeDislike error:', error);
    throw error;
  }
}
// Get user's liked videos
export const getUserLikedVideos = async (): Promise<Set<string>> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from('videos')
    .select('id')
    .contains('liked_by', [user.id]);

  if (error) throw error;
  
  return new Set(data.map(video => video.id));
}

export const updateViewCount = async ({ id }: { id: string }) => {
    const { error } = await supabase
        .rpc('increment_views', { video_id: id });

    if (error) throw error;
}

export const getProfile = async ({ id }: { id: string }) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error
    return data
}

export const getUserVideos = async ({ id }: { id: string }) => {
    const { data, error } = await supabase
        .from('videos')
        .select(`*`)
        .eq('user_id', id)

    if (error) throw error
    return data
}

export const getLeaderBoardDetails = async () => {
    const { data, error } = await supabase
        .from('leaderboard')
        .select(`
            *,
            video:videos(
                user:users(*)
            )
        `)
        .order('score', { ascending: false })
        .limit(10);

    if (error) throw error;
    return data;
}