import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import {
  MessageSquare,
  Heart,
  Search,
  PlusCircle,
  Sparkles,
  ShieldCheck,
  Clock,
  Pin,
  Trash2,
  Edit3,
  ImageIcon,
  Play,
  RotateCcw,
} from 'lucide-react-native';
import { FeatureHeader } from './FeatureHeader';
import { CommunityPost, AVAILABLE_TAGS } from '../../types/community';
import { useCommunity } from '../../context/CommunityContext';
import { useAuthRole } from '../../context/RoleContext';
import { CreatePostModal } from './CreatePostModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { ThreadDetailScreen } from './ThreadDetailScreen';
import { fetchMockCommunityPosts } from '../../data/communityData';
import { formatRelativeTime } from '../../utils/dateUtils';

const PAGE_SIZE = 10;
const FILTER_TAGS = ['Semua', ...AVAILABLE_TAGS];

export interface CommunityTabContentProps {
  onOpenProfile?: () => void;
}

export const CommunityTabContent: React.FC<CommunityTabContentProps> = ({ onOpenProfile }) => {
  const {
    posts,
    activeThreadPost,
    setActiveThreadPost,
    toggleLikePost,
    deletePost,
    createPost,
    updatePost,
    resetToInitialData,
  } = useCommunity();
  const { user } = useAuthRole();

  const [selectedTag, setSelectedTag] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);

  // Custom Delete Modal states
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [postToDelete, setPostToDelete] = useState<CommunityPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMoreData, setHasMoreData] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleCreatePost = () => {
    setEditingPost(null);
    setIsCreateModalOpen(true);
  };

  const handleEditPost = (post: CommunityPost) => {
    setEditingPost(post);
    setIsCreateModalOpen(true);
  };

  const handleOpenDeleteModal = (post: CommunityPost) => {
    setPostToDelete(post);
    setIsDeleteModalVisible(true);
  };

  const handleExecuteDelete = async () => {
    if (!postToDelete) return;
    try {
      setIsDeleting(true);
      await deletePost(postToDelete.id);
      setIsDeleteModalVisible(false);
      setPostToDelete(null);
    } catch (err) {
      console.warn('Gagal menghapus postingan:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter all posts based on tag and query
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesTag = selectedTag === 'Semua' || post.tag === selectedTag;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        q === '' ||
        post.title.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q) ||
        post.author.toLowerCase().includes(q) ||
        post.school.toLowerCase().includes(q);
      return matchesTag && matchesQuery;
    });
  }, [posts, selectedTag, searchQuery]);

  // Paginated visible slice of posts for the FlatList (loads chunks of PAGE_SIZE items)
  const visiblePosts = useMemo(() => {
    return filteredPosts.slice(0, currentPage * PAGE_SIZE);
  }, [filteredPosts, currentPage]);

  // Dynamically update hasMoreData
  useEffect(() => {
    setHasMoreData(currentPage * PAGE_SIZE < filteredPosts.length);
  }, [currentPage, filteredPosts.length]);

  // Reset pagination to page 1 whenever filters or search terms change
  useEffect(() => {
    setCurrentPage(1);
    setIsLoadingMore(false);
  }, [selectedTag, searchQuery]);

  // Infinite scroll loader attached to FlatList's onEndReached
  const handleLoadMore = async () => {
    // Guard: Do not trigger if already loading, no more items, or entire list fits in 1 page
    if (isLoadingMore || !hasMoreData || filteredPosts.length <= PAGE_SIZE) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const nextPage = currentPage + 1;
      const response = await fetchMockCommunityPosts(posts, {
        page: nextPage,
        limit: PAGE_SIZE,
        tag: selectedTag,
        search: searchQuery,
      });

      setCurrentPage(nextPage);
      setHasMoreData(response.hasMore);
    } catch (error) {
      console.warn('Gagal memuat halaman berikutnya:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setCurrentPage(1);
    setHasMoreData(filteredPosts.length > PAGE_SIZE);
    setIsLoadingMore(false);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  // FlatList Header: Banner, Search Bar, Horizontal Filter Chips
  const renderHeader = useCallback(() => {
    return (
      <View>
        {/* Banner Komunitas */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerTopRow}>
            <View style={styles.bannerBadge}>
              <Sparkles size={13} color="#D97706" />
              <Text style={styles.bannerBadgeText}>Forum Guru Validator MBG</Text>
            </View>
            <View style={styles.memberBadge}>
              <ShieldCheck size={13} color="#10B981" />
              <Text style={styles.memberBadgeText}>148 Sekolah Terverifikasi</Text>
            </View>
          </View>
          <Text style={styles.bannerTitle}>Ruang Kolaborasi & Tanya Jawab SOP</Text>
          <Text style={styles.bannerSubtitle}>
            Berbagi praktik baik, tips penanganan boks makanan, dan solusi kendala distribusi bersama sesama guru validator.
          </Text>

          <TouchableOpacity
            style={styles.newPostButton}
            onPress={handleCreatePost}
            activeOpacity={0.85}
          >
            <PlusCircle size={18} color="#FFFFFF" />
            <Text style={styles.newPostButtonText}>Mulai Diskusi Baru</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari topik diskusi atau nama sekolah..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Horizontal Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {FILTER_TAGS.map((tag) => {
            const isActive = selectedTag === tag;
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedTag(tag)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }, [searchQuery, selectedTag]);

  // FlatList Footer: Spinner (while loading more), End-of-feed notice, and Restore mock data button
  const renderFooter = useCallback(() => {
    return (
      <View style={styles.footerWrapper}>
        {/* Infinite Scroll ActivityIndicator Spinner */}
        {isLoadingMore && (
          <View style={styles.footerLoaderBox}>
            <ActivityIndicator size="small" color="#EBA338" />
            <Text style={styles.footerLoadingText}>Memuat diskusi lainnya...</Text>
          </View>
        )}

        {/* All Data Loaded Indicator */}
        {!hasMoreData && filteredPosts.length > 0 && !isLoadingMore && (
          <View style={styles.footerEndBox}>
            <View style={styles.footerEndLine} />
            <Text style={styles.footerEndText}>Semua diskusi telah dimuat</Text>
            <View style={styles.footerEndLine} />
          </View>
        )}

        {/* Reset Mock Data Option for Testing */}
        <TouchableOpacity
          style={styles.resetMockRow}
          onPress={() => {
            Alert.alert(
              'Reset Data Contoh',
              'Kembalikan forum ke data awal (20 diskusi contoh)?',
              [
                { text: 'Batal', style: 'cancel' },
                {
                  text: 'Reset',
                  onPress: async () => {
                    await resetToInitialData();
                    setCurrentPage(1);
                    setHasMoreData(true);
                  },
                },
              ],
            );
          }}
          activeOpacity={0.7}
        >
          <RotateCcw size={12} color="#94A3B8" />
          <Text style={styles.resetMockText}>Pulihkan Data Contoh Forum</Text>
        </TouchableOpacity>
      </View>
    );
  }, [isLoadingMore, hasMoreData, filteredPosts.length, resetToInitialData]);

  // Empty State Component
  const renderEmpty = useCallback(() => {
    return (
      <View style={styles.emptyStateCard}>
        <MessageSquare size={36} color="#CBD5E1" />
        <Text style={styles.emptyStateTitle}>Tidak ada diskusi ditemukan</Text>
        <Text style={styles.emptyStateSubtitle}>
          {searchQuery
            ? `Tidak ada diskusi yang cocok dengan "${searchQuery}".`
            : 'Belum ada topik diskusi untuk kategori ini. Jadilah yang pertama memulai!'}
        </Text>
        <TouchableOpacity
          style={styles.emptyStateBtn}
          onPress={handleCreatePost}
          activeOpacity={0.8}
        >
          <PlusCircle size={16} color="#FFFFFF" />
          <Text style={styles.emptyStateBtnText}>Buat Diskusi Sekarang</Text>
        </TouchableOpacity>
      </View>
    );
  }, [searchQuery]);

  // Render individual Post Card
  const renderItem = useCallback(
    ({ item: post }: { item: CommunityPost }) => {
      const isAuthor =
        post.authorId === user.id ||
        post.author === user.name ||
        user.name.includes(post.author);

      const totalReplies = (post.comments || []).reduce(
        (acc, c) => acc + 1 + (c.replies ? c.replies.length : 0),
        0,
      );

      return (
        <TouchableOpacity
          style={styles.postCard}
          activeOpacity={0.88}
          onPress={() => setActiveThreadPost(post)}
        >
          {post.isPinned && (
            <View style={styles.pinnedBanner}>
              <Pin size={12} color="#D97706" />
              <Text style={styles.pinnedText}>Disematkan oleh Fasilitator BGN</Text>
            </View>
          )}

          {/* Author Info & Tag & Optional Delete */}
          <View style={styles.postHeader}>
            <View style={styles.authorMeta}>
              <Text style={styles.authorName}>{post.author}</Text>
              <Text style={styles.authorSchool}>{post.school}</Text>
            </View>

            <View style={styles.headerRightBadges}>
              <View style={[styles.tagBadge, { backgroundColor: post.tagBg }]}>
                <Text style={[styles.tagText, { color: post.tagColor }]}>{post.tag}</Text>
              </View>

              {isAuthor && (
                <View style={styles.authorActionsRow}>
                  <TouchableOpacity
                    style={styles.editMiniBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleEditPost(post);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Edit Diskusi"
                  >
                    <Edit3 size={13} color="#D97706" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteMiniBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleOpenDeleteModal(post);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Hapus Diskusi"
                  >
                    <Trash2 size={13} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Content */}
          <Text style={styles.postTitle}>{post.title}</Text>
          <Text style={styles.postSnippet} numberOfLines={3}>
            {post.content}
          </Text>

          {/* Media Preview thumbnail if attached */}
          {post.mediaUri && (
            <View style={styles.thumbnailContainer}>
              {post.mediaType === 'video' ? (
                <View style={styles.videoThumbnailCard}>
                  <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.videoThumbnailText}>Video Dokumentasi Boks</Text>
                </View>
              ) : (
                <View style={styles.imageThumbnailWrapper}>
                  <Image
                    source={{ uri: post.mediaUri }}
                    style={styles.imageThumbnail}
                    resizeMode="cover"
                  />
                  <View style={styles.imageTagBadge}>
                    <ImageIcon size={11} color="#FFFFFF" />
                    <Text style={styles.imageTagText}>Foto</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Footer Meta */}
          <View style={styles.postFooter}>
            <View style={styles.timeWrapper}>
              <Clock size={12} color="#94A3B8" />
              <Text style={styles.timeText}>{formatRelativeTime(post.createdAt || post.timeAgo)}</Text>
            </View>

            <View style={styles.postActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  toggleLikePost(post.id);
                }}
                activeOpacity={0.7}
              >
                <Heart
                  size={15}
                  color={post.isLiked ? '#EF4444' : '#64748B'}
                  fill={post.isLiked ? '#EF4444' : 'transparent'}
                />
                <Text style={[styles.actionCount, post.isLiked && styles.actionCountLiked]}>
                  {post.likesCount}
                </Text>
              </TouchableOpacity>

              <View style={styles.actionBtn}>
                <MessageSquare size={15} color="#64748B" />
                <Text style={styles.actionCount}>{totalReplies}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [user.id, user.name, deletePost, toggleLikePost, setActiveThreadPost],
  );

  // If a thread is selected, show detail screen (rendered after all hooks run)
  if (activeThreadPost) {
    const freshPost = posts.find((p) => p.id === activeThreadPost.id) || activeThreadPost;
    return (
      <ThreadDetailScreen
        post={freshPost}
        onBack={() => setActiveThreadPost(null)}
        onOpenProfile={onOpenProfile}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {/* Universal Clean App Bar Header */}
      <FeatureHeader title="Komunitas" onOpenProfile={onOpenProfile} />

      {/* Optimized Paginated FlatList with Infinite Scrolling */}
      <FlatList
        data={visiblePosts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={styles.postSeparator} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#EBA338']}
            tintColor="#EBA338"
          />
        }
      />

      {/* Modal Mulai / Edit Diskusi */}
      <CreatePostModal
        visible={isCreateModalOpen}
        mode={editingPost ? 'edit' : 'create'}
        initialData={editingPost}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingPost(null);
        }}
        onSubmit={async (data) => {
          if (editingPost) {
            await updatePost({
              id: editingPost.id,
              title: data.title,
              content: data.content,
              tag: data.tag,
              mediaUri: data.mediaUri,
              mediaType: data.mediaType,
            });
          } else {
            const newPost = await createPost(data);
            setActiveThreadPost(newPost);
          }
          setEditingPost(null);
        }}
      />

      {/* Modal Konfirmasi Hapus Diskusi */}
      <DeleteConfirmationModal
        visible={isDeleteModalVisible}
        title="Hapus Diskusi"
        postTitle={postToDelete?.title}
        message="Apakah Anda yakin ingin menghapus topik diskusi ini? Tindakan ini tidak dapat dibatalkan."
        isDeleting={isDeleting}
        onCancel={() => {
          setIsDeleteModalVisible(false);
          setPostToDelete(null);
        }}
        onConfirm={handleExecuteDelete}
      />
    </View>
  );
};

export const KomunitasScreen = CommunityTabContent;
export default CommunityTabContent;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9F8F6',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 130, // Clears floating bottom navigation bar
  },
  bannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  bannerBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#D97706',
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  memberBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  bannerSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  newPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBA338',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#EBA338',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  newPostButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  postSeparator: {
    height: 14,
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptyStateSubtitle: {
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyStateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EBA338',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  emptyStateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  pinnedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  authorMeta: {
    flex: 1,
  },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  authorSchool: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  headerRightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  authorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editMiniBtn: {
    padding: 5,
    backgroundColor: '#FEF3C7',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteMiniBtn: {
    padding: 5,
    backgroundColor: '#FEE2E2',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 20,
    marginBottom: 6,
  },
  postSnippet: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  thumbnailContainer: {
    marginBottom: 12,
  },
  imageThumbnailWrapper: {
    position: 'relative',
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageThumbnail: {
    width: '100%',
    height: '100%',
  },
  imageTagBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  imageTagText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  videoThumbnailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  videoThumbnailText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  actionCountLiked: {
    color: '#EF4444',
  },
  footerWrapper: {
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'center',
  },
  footerLoaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 8,
  },
  footerLoadingText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  footerEndBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 10,
    width: '100%',
    marginBottom: 6,
  },
  footerEndLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  footerEndText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  resetMockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  resetMockText: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
