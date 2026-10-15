import { CommunityPost, COMMUNITY_TAG_CONFIGS } from '../types/community';
import { INITIAL_COMMUNITY_POSTS } from '../data/communityData';
import { AsyncStorage } from '../lib/storage';

/**
 * Kunci penyimpanan lokal forum komunitas.
 * Menggunakan 'forum_posts' sesuai spesifikasi dan kompatibilitas AsyncStorage.
 */
export const FORUM_STORAGE_KEY = 'forum_posts';
export const LEGACY_STORAGE_KEY = '@kawangizi_community_posts';

export interface CreatePostPayload {
  title: string;
  content: string;
  tag: string;
  mediaUri?: string;
  mediaType?: 'image' | 'video';
  author: string;
  school: string;
  authorId: string;
}

export interface UpdatePostPayload {
  id: string;
  title: string;
  content: string;
  tag: string;
  mediaUri?: string;
  mediaType?: 'image' | 'video';
}

/**
 * Service Layer: Forum Komunitas KawanGizi
 *
 * Catatan Arsitektur (Persiapan Sinkronisasi Backend Golang):
 * Saat ini setiap mutasi data disimpan ke AsyncStorage/localStorage secara lokal.
 * Ketika API Golang backend telah selesai diimplementasikan, seluruh fungsi di bawah ini
 * dapat langsung diarahkan ke endpoint REST API yang relevan tanpa merombak UI komponen.
 */
export const forumService = {
  /**
   * Mengambil daftar seluruh postingan forum.
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * const res = await apiClient.get<CommunityPost[]>('/api/v1/community/posts');
   * return res.data;
   */
  async getPosts(): Promise<CommunityPost[]> {
    try {
      // Coba ambil dari kunci utama 'forum_posts' terlebih dahulu
      let storedJson = await AsyncStorage.getItem(FORUM_STORAGE_KEY);
      if (!storedJson) {
        // Fallback untuk membaca data lama jika ada
        storedJson = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      }

      if (storedJson) {
        try {
          const parsed = JSON.parse(storedJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch (parseErr) {
          console.warn('[forumService] Gagal parse JSON lokal, menggunakan seed data:', parseErr);
        }
      }

      // Inisialisasi awal dengan mock data jika storage masih kosong
      await this.savePosts(INITIAL_COMMUNITY_POSTS);
      return INITIAL_COMMUNITY_POSTS;
    } catch (err) {
      console.warn('[forumService] Gagal memuat postingan forum:', err);
      return INITIAL_COMMUNITY_POSTS;
    }
  },

  /**
   * Menyimpan daftar postingan terbaru ke AsyncStorage / localStorage.
   * Dipanggil secara eksplisit setelah SETIAP mutasi data (create, like, delete, update).
   */
  async savePosts(posts: CommunityPost[]): Promise<void> {
    try {
      const json = JSON.stringify(posts);
      await AsyncStorage.setItem(FORUM_STORAGE_KEY, json);
      // Simpan juga ke legacy key untuk redundansi keamanan
      await AsyncStorage.setItem(LEGACY_STORAGE_KEY, json);
    } catch (err) {
      console.warn('[forumService] Gagal menyimpan data ke AsyncStorage:', err);
      throw err;
    }
  },

  /**
   * Membuat postingan baru dengan dynamic timestamp ISO.
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * const res = await apiClient.post<CommunityPost>('/api/v1/community/posts', payload);
   * return res.data;
   */
  async createPost(payload: CreatePostPayload, currentPosts: CommunityPost[]): Promise<{
    newPost: CommunityPost;
    updatedPosts: CommunityPost[];
  }> {
    const tagCfg = COMMUNITY_TAG_CONFIGS[payload.tag] || {
      label: payload.tag,
      color: '#2563EB',
      bg: '#DBEAFE',
    };

    const newPost: CommunityPost = {
      id: `post-${Date.now()}`,
      author: payload.author,
      school: payload.school,
      authorId: payload.authorId,
      timeAgo: 'Baru saja',
      createdAt: new Date().toISOString(), // Dynamic ISO timestamp
      tag: payload.tag,
      tagColor: tagCfg.color,
      tagBg: tagCfg.bg,
      title: payload.title.trim(),
      content: payload.content.trim(),
      mediaUri: payload.mediaUri,
      mediaType: payload.mediaType || 'image',
      likesCount: 0,
      isLiked: false,
      comments: [],
    };

    const updatedPosts = [newPost, ...currentPosts];
    await this.savePosts(updatedPosts);
    return { newPost, updatedPosts };
  },

  /**
   * Memperbarui konten postingan yang ada.
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * const res = await apiClient.put<CommunityPost>(`/api/v1/community/posts/${payload.id}`, payload);
   * return res.data;
   */
  async updatePost(payload: UpdatePostPayload, currentPosts: CommunityPost[]): Promise<{
    updatedPost: CommunityPost;
    updatedPosts: CommunityPost[];
  }> {
    const tagCfg = COMMUNITY_TAG_CONFIGS[payload.tag] || {
      label: payload.tag,
      color: '#2563EB',
      bg: '#DBEAFE',
    };

    let targetUpdatedPost: CommunityPost | null = null;

    const updatedPosts = currentPosts.map((post) => {
      if (post.id === payload.id) {
        targetUpdatedPost = {
          ...post,
          title: payload.title.trim(),
          content: payload.content.trim(),
          tag: payload.tag,
          tagColor: tagCfg.color,
          tagBg: tagCfg.bg,
          mediaUri: payload.mediaUri,
          mediaType: payload.mediaType || post.mediaType || 'image',
        };
        return targetUpdatedPost;
      }
      return post;
    });

    if (!targetUpdatedPost) {
      throw new Error(`Diskusi dengan ID ${payload.id} tidak ditemukan.`);
    }

    await this.savePosts(updatedPosts);
    return { updatedPost: targetUpdatedPost, updatedPosts };
  },

  /**
   * Menghapus postingan berdasarkan ID.
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * await apiClient.delete(`/api/v1/community/posts/${postId}`);
   */
  async deletePost(postId: string, currentPosts: CommunityPost[]): Promise<CommunityPost[]> {
    const updatedPosts = currentPosts.filter((p) => p.id !== postId);
    await this.savePosts(updatedPosts);
    return updatedPosts;
  },

  /**
   * Mengubah status suka (like/unlike) pada postingan.
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * await apiClient.post(`/api/v1/community/posts/${postId}/like`);
   */
  async toggleLikePost(postId: string, currentPosts: CommunityPost[]): Promise<CommunityPost[]> {
    const updatedPosts = currentPosts.map((post) => {
      if (post.id === postId) {
        const isLiked = !post.isLiked;
        const likesCount = Math.max(0, post.likesCount + (isLiked ? 1 : -1));
        return {
          ...post,
          isLiked,
          likesCount,
        };
      }
      return post;
    });

    await this.savePosts(updatedPosts);
    return updatedPosts;
  },

  /**
   * Menambahkan tanggapan/komentar baru ke suatu postingan.
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * const res = await apiClient.post(`/api/v1/community/posts/${postId}/comments`, { content });
   * return res.data;
   */
  async addComment(
    postId: string,
    content: string,
    authorData: { name: string; school: string; id: string },
    currentPosts: CommunityPost[]
  ): Promise<CommunityPost[]> {
    if (!content.trim()) return currentPosts;

    const newComment = {
      id: `c-${Date.now()}`,
      author: authorData.name,
      school: authorData.school,
      authorId: authorData.id,
      timeAgo: 'Baru saja',
      createdAt: new Date().toISOString(),
      content: content.trim(),
      likesCount: 0,
      isLiked: false,
      replies: [],
    };

    const updatedPosts = currentPosts.map((post) => {
      if (post.id === postId) {
        return {
          ...post,
          comments: [...(post.comments || []), newComment],
        };
      }
      return post;
    });

    await this.savePosts(updatedPosts);
    return updatedPosts;
  },

  /**
   * Menambahkan balasan komentar bertingkat.
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * const res = await apiClient.post(`/api/v1/community/posts/${postId}/comments/${commentId}/replies`, { content });
   * return res.data;
   */
  async addReply(
    postId: string,
    commentId: string,
    content: string,
    authorData: { name: string; school: string; id: string },
    currentPosts: CommunityPost[]
  ): Promise<CommunityPost[]> {
    if (!content.trim()) return currentPosts;

    const newReply = {
      id: `r-${Date.now()}`,
      author: authorData.name,
      school: authorData.school,
      authorId: authorData.id,
      timeAgo: 'Baru saja',
      createdAt: new Date().toISOString(),
      content: content.trim(),
      likesCount: 0,
      isLiked: false,
    };

    const updatedPosts = currentPosts.map((post) => {
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

    await this.savePosts(updatedPosts);
    return updatedPosts;
  },

  /**
   * Mengubah status suka pada komentar.
   *
   * [BACKEND_SYNC]: Nanti digantikan dengan:
   * await apiClient.post(`/api/v1/community/posts/${postId}/comments/${commentId}/like`);
   */
  async toggleLikeComment(
    postId: string,
    commentId: string,
    currentPosts: CommunityPost[]
  ): Promise<CommunityPost[]> {
    const updatedPosts = currentPosts.map((post) => {
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

    await this.savePosts(updatedPosts);
    return updatedPosts;
  },

  /**
   * Reset data ke postingan awal bawaan sistem
   */
  async resetToInitial(): Promise<CommunityPost[]> {
    await this.savePosts(INITIAL_COMMUNITY_POSTS);
    return INITIAL_COMMUNITY_POSTS;
  },
};
