import { useState, useEffect, useCallback } from 'react';
import { CommunityPost } from '../types/community';
import { forumService, CreatePostPayload, UpdatePostPayload } from '../services/forumService';
import { useAuthRole } from '../context/RoleContext';

/**
 * Custom Hook: useForumPosts
 *
 * Mengabstraksi pengambilan data forum dan operasi mutasi (Create, Read, Update, Delete, Like).
 * Menggunakan forumService untuk persistensi lokal (AsyncStorage/localStorage)
 * dan siap dihubungkan langsung ke REST API Golang Backend.
 */
export function useForumPosts() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThreadPost, setActiveThreadPost] = useState<CommunityPost | null>(null);
  const { user } = useAuthRole();

  // Memuat data postingan saat inisialisasi / mount
  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await forumService.getPosts();
      setPosts(data);
    } catch (err) {
      console.warn('[useForumPosts] Gagal memuat data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Sync activeThreadPost setiap kali array posts berubah
  useEffect(() => {
    if (activeThreadPost) {
      const fresh = posts.find((p) => p.id === activeThreadPost.id);
      if (fresh && fresh !== activeThreadPost) {
        setActiveThreadPost(fresh);
      }
    }
  }, [posts, activeThreadPost]);

  const createPost = useCallback(
    async (
      input: Omit<CreatePostPayload, 'author' | 'school' | 'authorId'>
    ): Promise<CommunityPost> => {
      const payload: CreatePostPayload = {
        ...input,
        author: user?.name || 'Guru Validator MBG',
        school: user?.schoolName || 'SDN Menteng 01 Pagi',
        authorId: user?.id || 'current-user',
      };
      const { newPost, updatedPosts } = await forumService.createPost(payload, posts);
      setPosts(updatedPosts);
      return newPost;
    },
    [posts, user]
  );

  const updatePost = useCallback(
    async (input: UpdatePostPayload): Promise<CommunityPost> => {
      const { updatedPost, updatedPosts } = await forumService.updatePost(input, posts);
      setPosts(updatedPosts);
      return updatedPost;
    },
    [posts]
  );

  const deletePost = useCallback(
    async (postId: string): Promise<void> => {
      const updatedPosts = await forumService.deletePost(postId, posts);
      setPosts(updatedPosts);
      if (activeThreadPost?.id === postId) {
        setActiveThreadPost(null);
      }
    },
    [posts, activeThreadPost]
  );

  const toggleLikePost = useCallback(
    async (postId: string): Promise<void> => {
      const updatedPosts = await forumService.toggleLikePost(postId, posts);
      setPosts(updatedPosts);
    },
    [posts]
  );

  const addComment = useCallback(
    async (postId: string, content: string): Promise<void> => {
      const authorData = {
        name: user?.name || 'Guru Validator MBG',
        school: user?.schoolName || 'SDN Menteng 01 Pagi',
        id: user?.id || 'current-user',
      };
      const updatedPosts = await forumService.addComment(postId, content, authorData, posts);
      setPosts(updatedPosts);
    },
    [posts, user]
  );

  const addReply = useCallback(
    async (postId: string, commentId: string, content: string): Promise<void> => {
      const authorData = {
        name: user?.name || 'Guru Validator MBG',
        school: user?.schoolName || 'SDN Menteng 01 Pagi',
        id: user?.id || 'current-user',
      };
      const updatedPosts = await forumService.addReply(postId, commentId, content, authorData, posts);
      setPosts(updatedPosts);
    },
    [posts, user]
  );

  const toggleLikeComment = useCallback(
    async (postId: string, commentId: string): Promise<void> => {
      const updatedPosts = await forumService.toggleLikeComment(postId, commentId, posts);
      setPosts(updatedPosts);
    },
    [posts]
  );

  const resetToInitialData = useCallback(async (): Promise<void> => {
    const defaultPosts = await forumService.resetToInitial();
    setPosts(defaultPosts);
  }, []);

  return {
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
    refreshPosts: loadPosts,
  };
}
