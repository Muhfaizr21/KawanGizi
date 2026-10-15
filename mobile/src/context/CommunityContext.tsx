import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { CommunityPost, COMMUNITY_TAG_CONFIGS } from '../types/community';
import {
  INITIAL_COMMUNITY_POSTS,
  fetchMockCommunityPosts,
  FetchCommunityParams,
  PaginatedCommunityResponse,
} from '../data/communityData';
import { AsyncStorage } from '../lib/storage';
import { forumService, FORUM_STORAGE_KEY } from '../services/forumService';
import { useAuthRole } from './RoleContext';

interface CreatePostInput {
  title: string;
  content: string;
  tag: string;
  mediaUri?: string;
  mediaType?: 'image' | 'video';
}

export interface UpdatePostInput {
  id: string;
  title: string;
  content: string;
  tag: string;
  mediaUri?: string;
  mediaType?: 'image' | 'video';
}

interface CommunityContextType {
  posts: CommunityPost[];
  loading: boolean;
  activeThreadPost: CommunityPost | null;
  setActiveThreadPost: (post: CommunityPost | null) => void;
  createPost: (input: CreatePostInput) => Promise<CommunityPost>;
  updatePost: (input: UpdatePostInput) => Promise<CommunityPost>;
  deletePost: (postId: string) => Promise<void>;
  toggleLikePost: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string) => Promise<void>;
  addReply: (postId: string, commentId: string, content: string) => Promise<void>;
  toggleLikeComment: (postId: string, commentId: string) => Promise<void>;
  resetToInitialData: () => Promise<void>;
  fetchPaginatedPosts: (params?: FetchCommunityParams) => Promise<PaginatedCommunityResponse>;
}

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

export const CommunityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_COMMUNITY_POSTS);
  const [activeThreadPost, setActiveThreadPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthRole();

  /**
   * Hydration State dari AsyncStorage / localStorage saat aplikasi pertama kali dimuat.
   * Memastikan data yang tersimpan (postingan baru, like count, komentar) TIDAK di-reset
   * saat halaman browser di-refresh.
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan pemanggilan REST API:
   * const serverPosts = await apiClient.get('/api/v1/community/posts');
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loadedPosts = await forumService.getPosts();
        if (cancelled) return;

        if (Array.isArray(loadedPosts) && loadedPosts.length > 0) {
          setPosts(loadedPosts);
        } else {
          setPosts(INITIAL_COMMUNITY_POSTS);
          await AsyncStorage.setItem(FORUM_STORAGE_KEY, JSON.stringify(INITIAL_COMMUNITY_POSTS));
        }
      } catch (err) {
        console.warn('[CommunityContext] Load community posts error:', err);
        if (!cancelled) {
          setPosts(INITIAL_COMMUNITY_POSTS);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Helper internal untuk mengupdate state dan secara eksplisit menyimpan ke AsyncStorage.
   * Menjamin sinkronisasi instan ke storage lokal.
   */
  const persistPosts = useCallback(
    async (updated: CommunityPost[]) => {
      setPosts(updated);

      // Sinkronkan active thread jika sedang dibuka
      setActiveThreadPost((current) => {
        if (!current) return null;
        return updated.find((p) => p.id === current.id) || null;
      });

      try {
        await AsyncStorage.setItem(FORUM_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('[CommunityContext] Save community posts error:', err);
      }
    },
    []
  );

  /**
   * Tambah Postingan Baru dengan ISO createdAt timestamp
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * await apiClient.post('/api/v1/community/posts', payload);
   */
  const createPost = useCallback(
    async (input: CreatePostInput): Promise<CommunityPost> => {
      const tagCfg = COMMUNITY_TAG_CONFIGS[input.tag] || {
        label: input.tag,
        color: '#2563EB',
        bg: '#DBEAFE',
      };

      const newPost: CommunityPost = {
        id: `post-${Date.now()}`,
        author: user?.name || 'Guru Validator MBG',
        school: user?.schoolName || 'SDN Menteng 01 Pagi',
        authorId: user?.id || 'current-user',
        timeAgo: 'Baru saja',
        createdAt: new Date().toISOString(), // Dynamic timestamp ISO
        tag: input.tag,
        tagColor: tagCfg.color,
        tagBg: tagCfg.bg,
        title: input.title.trim(),
        content: input.content.trim(),
        mediaUri: input.mediaUri,
        mediaType: input.mediaType || 'image',
        likesCount: 0,
        isLiked: false,
        comments: [],
      };

      const updated = [newPost, ...posts];
      await persistPosts(updated);
      return newPost;
    },
    [posts, user, persistPosts]
  );

  /**
   * Update Postingan
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * await apiClient.put(`/api/v1/community/posts/${input.id}`, payload);
   */
  const updatePost = useCallback(
    async (input: UpdatePostInput): Promise<CommunityPost> => {
      const tagCfg = COMMUNITY_TAG_CONFIGS[input.tag] || {
        label: input.tag,
        color: '#2563EB',
        bg: '#DBEAFE',
      };

      let updatedPost: CommunityPost | null = null;

      const updated = posts.map((post) => {
        if (post.id === input.id) {
          updatedPost = {
            ...post,
            title: input.title.trim(),
            content: input.content.trim(),
            tag: input.tag,
            tagColor: tagCfg.color,
            tagBg: tagCfg.bg,
            mediaUri: input.mediaUri,
            mediaType: input.mediaType || post.mediaType || 'image',
          };
          return updatedPost;
        }
        return post;
      });

      if (!updatedPost) {
        throw new Error(`Diskusi dengan ID ${input.id} tidak ditemukan.`);
      }

      await persistPosts(updated);
      return updatedPost;
    },
    [posts, persistPosts]
  );

  /**
   * Hapus Postingan
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * await apiClient.delete(`/api/v1/community/posts/${postId}`);
   */
  const deletePost = useCallback(
    async (postId: string) => {
      const updated = posts.filter((p) => p.id !== postId);
      await persistPosts(updated);
    },
    [posts, persistPosts]
  );

  /**
   * Suka / Batal Suka Postingan (Like / Unlike)
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * await apiClient.post(`/api/v1/community/posts/${postId}/like`);
   */
  const toggleLikePost = useCallback(
    async (postId: string) => {
      const updated = posts.map((post) => {
        if (post.id === postId) {
          const isLiked = !post.isLiked;
          const likesCount = Math.max(0, post.likesCount + (isLiked ? 1 : -1));
          return { ...post, isLiked, likesCount };
        }
        return post;
      });

      await persistPosts(updated);
    },
    [posts, persistPosts]
  );

  /**
   * Tambah Komentar Utama
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * await apiClient.post(`/api/v1/community/posts/${postId}/comments`, { content });
   */
  const addComment = useCallback(
    async (postId: string, content: string) => {
      if (!content.trim()) return;

      const newComment = {
        id: `c-${Date.now()}`,
        author: user?.name || 'Guru Validator MBG',
        school: user?.schoolName || 'SDN Menteng 01 Pagi',
        authorId: user?.id || 'current-user',
        timeAgo: 'Baru saja',
        createdAt: new Date().toISOString(),
        content: content.trim(),
        likesCount: 0,
        isLiked: false,
        replies: [],
      };

      const updated = posts.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...(post.comments || []), newComment],
          };
        }
        return post;
      });

      await persistPosts(updated);
    },
    [posts, user, persistPosts]
  );

  /**
   * Tambah Balasan Komentar Bertingkat
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * await apiClient.post(`/api/v1/community/posts/${postId}/comments/${commentId}/replies`, { content });
   */
  const addReply = useCallback(
    async (postId: string, commentId: string, content: string) => {
      if (!content.trim()) return;

      const newReply = {
        id: `r-${Date.now()}`,
        author: user?.name || 'Guru Validator MBG',
        school: user?.schoolName || 'SDN Menteng 01 Pagi',
        authorId: user?.id || 'current-user',
        timeAgo: 'Baru saja',
        createdAt: new Date().toISOString(),
        content: content.trim(),
        likesCount: 0,
        isLiked: false,
      };

      const updated = posts.map((post) => {
        if (post.id === postId) {
          const updatedComments = (post.comments || []).map((comment) => {
            if (comment.id === commentId) {
              return {
                ...comment,
                replies: [...(comment.replies || []), newReply],
              };
            }
            return comment;
          });
          return {
            ...post,
            comments: updatedComments,
          };
        }
        return post;
      });

      await persistPosts(updated);
    },
    [posts, user, persistPosts]
  );

  /**
   * Suka Komentar
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * await apiClient.post(`/api/v1/community/posts/${postId}/comments/${commentId}/like`);
   */
  const toggleLikeComment = useCallback(
    async (postId: string, commentId: string) => {
      const updated = posts.map((post) => {
        if (post.id === postId) {
          const updatedComments = (post.comments || []).map((c) => {
            if (c.id === commentId) {
              const isLiked = !c.isLiked;
              const likesCount = Math.max(0, (c.likesCount || 0) + (isLiked ? 1 : -1));
              return { ...c, isLiked, likesCount };
            }
            return c;
          });
          return { ...post, comments: updatedComments };
        }
        return post;
      });

      await persistPosts(updated);
    },
    [posts, persistPosts]
  );

  /**
   * Reset seluruh postingan ke dataset awal bawaan
   */
  const resetToInitialData = useCallback(async () => {
    await persistPosts(INITIAL_COMMUNITY_POSTS);
  }, [persistPosts]);

  /**
   * Pagination Query untuk FlatList Feed
   */
  const fetchPaginatedPosts = useCallback(
    async (params?: FetchCommunityParams): Promise<PaginatedCommunityResponse> => {
      return fetchMockCommunityPosts(posts, params);
    },
    [posts]
  );

  const value = useMemo(
    () => ({
      posts,
      loading,
      activeThreadPost,
      setActiveThreadPost,
      createPost,
      updatePost,
      deletePost,
      toggleLikePost,
      addComment,
      addReply,
      toggleLikeComment,
      resetToInitialData,
      fetchPaginatedPosts,
    }),
    [
      posts,
      loading,
      activeThreadPost,
      setActiveThreadPost,
      createPost,
      updatePost,
      deletePost,
      toggleLikePost,
      addComment,
      addReply,
      toggleLikeComment,
      resetToInitialData,
      fetchPaginatedPosts,
    ]
  );

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
};

export const useCommunity = (): CommunityContextType => {
  const context = useContext(CommunityContext);
  if (!context) {
    throw new Error('useCommunity must be used within a CommunityProvider');
  }
  return context;
};
export default useCommunity;
