import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Heart,
  MessageSquare,
  Share2,
  Clock,
  Pin,
  Send,
  Trash2,
  CornerDownRight,
  X,
  Play,
  Shield,
  CheckCircle2,
  Bell,
  Edit3,
} from 'lucide-react-native';
import { CommunityPost } from '../../types/community';
import { useCommunity } from '../../context/CommunityContext';
import { useAuthRole } from '../../context/RoleContext';
import { getInitials } from '../../utils/initials';
import { ProfileAvatarButton } from './ProfileAvatarButton';
import { CreatePostModal } from './CreatePostModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { formatRelativeTime } from '../../utils/dateUtils';

interface ThreadDetailScreenProps {
  post: CommunityPost;
  onBack: () => void;
  onOpenProfile?: () => void;
}

export const ThreadDetailScreen: React.FC<ThreadDetailScreenProps> = ({
  post: initialPost,
  onBack,
  onOpenProfile,
}) => {
  const {
    posts,
    toggleLikePost,
    deletePost,
    updatePost,
    addComment,
    addReply,
    toggleLikeComment,
  } = useCommunity();
  const { user } = useAuthRole();

  // Find latest state of this post from context
  const currentPost = posts.find((p) => p.id === initialPost.id) || initialPost;

  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    author: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const handleReplyTo = (commentId: string, author: string) => {
    setReplyingTo({ commentId, author });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const isAuthor =
    currentPost.authorId === user.id ||
    currentPost.author === user.name ||
    user.name.includes(currentPost.author) ||
    currentPost.author.includes(user.name);

  const handleDeletePost = () => {
    setIsDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deletePost(currentPost.id);
      setIsDeleteModalVisible(false);
      onBack();
    } catch (err) {
      console.warn('Gagal menghapus postingan:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;

    try {
      setIsSubmitting(true);
      if (replyingTo) {
        await addReply(currentPost.id, replyingTo.commentId, commentText.trim());
        setReplyingTo(null);
      } else {
        await addComment(currentPost.id, commentText.trim());
      }
      setCommentText('');
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.warn('Send comment error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = () => {
    Alert.alert(
      'Tautan Disalin',
      `Tautan diskusi "${currentPost.title}" telah disalin ke papan klip untuk dibagikan ke sesama guru validator.`,
      [{ text: 'OK' }],
    );
  };

  const totalComments = (currentPost.comments || []).reduce((acc, c) => {
    return acc + 1 + (c.replies ? c.replies.length : 0);
  }, 0);

  return (
    <View style={styles.screen}>
      {/* Header Top Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Daftar Forum"
          >
            <ArrowLeft size={20} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Detail Diskusi
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => {
              Alert.alert(
                'Pemberitahuan MBG',
                'Armada B-9281-KBA dari SPPG Menteng dijadwalkan tiba pukul 07:10 WIB untuk serah terima porsi hari ini.',
                [{ text: 'Tutup', style: 'default' }]
              );
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Pemberitahuan"
          >
            <Bell size={19} color="#1E293B" />
            <View style={styles.bellBadgeDot} />
          </TouchableOpacity>
          <ProfileAvatarButton onOpenProfile={onOpenProfile} size={36} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Main Thread Card */}
          <View style={styles.mainPostCard}>
            {currentPost.isPinned && (
              <View style={styles.pinnedBanner}>
                <Pin size={13} color="#D97706" />
                <Text style={styles.pinnedText}>Disematkan oleh Fasilitator BGN</Text>
              </View>
            )}

            {/* Top Meta: Tag & Delete Button */}
            <View style={styles.postMetaRow}>
              <View style={[styles.tagBadge, { backgroundColor: currentPost.tagBg }]}>
                <Text style={[styles.tagText, { color: currentPost.tagColor }]}>
                  {currentPost.tag}
                </Text>
              </View>

              {isAuthor && (
                <View style={styles.authorActionsRow}>
                  <TouchableOpacity
                    style={styles.editPostBtn}
                    onPress={() => setIsEditModalOpen(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Edit Diskusi"
                  >
                    <Edit3 size={15} color="#D97706" />
                    <Text style={styles.editPostText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deletePostBtn}
                    onPress={handleDeletePost}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Hapus Diskusi"
                  >
                    <Trash2 size={15} color="#EF4444" />
                    <Text style={styles.deletePostText}>Hapus</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Post Title */}
            <Text style={styles.postTitle}>{currentPost.title}</Text>

            {/* Author Profile Row */}
            <View style={styles.authorRow}>
              <View style={styles.authorAvatar}>
                <Text style={styles.authorAvatarText}>{getInitials(currentPost.author)}</Text>
              </View>
              <View style={styles.authorMeta}>
                <View style={styles.authorNameRow}>
                  <Text style={styles.authorName}>{currentPost.author}</Text>
                  <Shield size={13} color="#10B981" />
                </View>
                <Text style={styles.authorSchool}>{currentPost.school}</Text>
              </View>
              <View style={styles.timeBadge}>
                <Clock size={11} color="#94A3B8" />
                <Text style={styles.timeText}>{formatRelativeTime(currentPost.createdAt || currentPost.timeAgo)}</Text>
              </View>
            </View>

            {/* Post Content */}
            <Text style={styles.postContent}>{currentPost.content}</Text>

            {/* Attached Media */}
            {currentPost.mediaUri && (
              <View style={styles.mediaContainer}>
                {currentPost.mediaType === 'video' ? (
                  <View style={styles.videoPlayerCard}>
                    <View style={styles.playIconCircle}>
                      <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
                    </View>
                    <Text style={styles.videoNotice}>Video Lampiran Dokumentasi Boks</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: currentPost.mediaUri }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                )}
              </View>
            )}

            {/* Action Buttons Row */}
            <View style={styles.postActionsBar}>
              <TouchableOpacity
                style={[styles.actionButton, currentPost.isLiked && styles.actionButtonLiked]}
                onPress={() => toggleLikePost(currentPost.id)}
                activeOpacity={0.7}
              >
                <Heart
                  size={18}
                  color={currentPost.isLiked ? '#EF4444' : '#64748B'}
                  fill={currentPost.isLiked ? '#EF4444' : 'transparent'}
                />
                <Text
                  style={[
                    styles.actionButtonText,
                    currentPost.isLiked && styles.actionButtonTextLiked,
                  ]}
                >
                  {currentPost.likesCount} Suka
                </Text>
              </TouchableOpacity>

              <View style={styles.actionButton}>
                <MessageSquare size={18} color="#64748B" />
                <Text style={styles.actionButtonText}>{totalComments} Tanggapan</Text>
              </View>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Share2 size={17} color="#64748B" />
                <Text style={styles.actionButtonText}>Bagikan</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments Section Title */}
          <View style={styles.commentsHeader}>
            <View style={styles.commentsTitleRow}>
              <Text style={styles.commentsTitle}>Tanggapan & Diskusi</Text>
              <View style={styles.commentsCountBadge}>
                <Text style={styles.commentsCountText}>{totalComments}</Text>
              </View>
            </View>
            <Text style={styles.commentsSubtitle}>
              Solusi dan pandangan dari sesama validator terverifikasi
            </Text>
          </View>

          {/* Comments List */}
          <View style={styles.commentsList}>
            {(!currentPost.comments || currentPost.comments.length === 0) && (
              <View style={styles.emptyCommentsCard}>
                <MessageSquare size={32} color="#CBD5E1" />
                <Text style={styles.emptyCommentsTitle}>Belum ada tanggapan</Text>
                <Text style={styles.emptyCommentsSubtitle}>
                  Jadilah yang pertama memberikan masukan atau solusi untuk diskusi ini!
                </Text>
              </View>
            )}

            {(currentPost.comments || []).map((comment) => (
              <View key={comment.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>{getInitials(comment.author)}</Text>
                  </View>
                  <View style={styles.commentAuthorMeta}>
                    <Text style={styles.commentAuthorName}>{comment.author}</Text>
                    <Text style={styles.commentAuthorSchool}>{comment.school}</Text>
                  </View>
                  <Text style={styles.commentTime}>{formatRelativeTime(comment.createdAt || comment.timeAgo)}</Text>
                </View>

                <Text style={styles.commentContent}>{comment.content}</Text>

                {/* Comment Actions */}
                <View style={styles.commentActions}>
                  <TouchableOpacity
                    style={styles.commentActionBtn}
                    onPress={() => toggleLikeComment(currentPost.id, comment.id)}
                    activeOpacity={0.7}
                  >
                    <Heart
                      size={14}
                      color={comment.isLiked ? '#EF4444' : '#64748B'}
                      fill={comment.isLiked ? '#EF4444' : 'transparent'}
                    />
                    <Text
                      style={[
                        styles.commentActionText,
                        comment.isLiked && styles.commentActionTextLiked,
                      ]}
                    >
                      {comment.likesCount || 0}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.commentActionBtn}
                    onPress={() => handleReplyTo(comment.id, comment.author)}
                    activeOpacity={0.7}
                  >
                    <CornerDownRight size={13} color="#2563EB" />
                    <Text style={styles.replyButtonText}>Balas</Text>
                  </TouchableOpacity>
                </View>

                {/* Nested Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <View style={styles.nestedRepliesContainer}>
                    {comment.replies.map((reply) => (
                      <View key={reply.id} style={styles.nestedReplyItem}>
                        <View style={styles.nestedHeader}>
                          <View style={styles.nestedAvatar}>
                            <Text style={styles.nestedAvatarText}>
                              {getInitials(reply.author)}
                            </Text>
                          </View>
                          <View style={styles.nestedAuthorMeta}>
                            <Text style={styles.nestedAuthorName}>{reply.author}</Text>
                            <Text style={styles.nestedAuthorSchool}>{reply.school}</Text>
                          </View>
                          <Text style={styles.nestedTime}>{formatRelativeTime(reply.createdAt || reply.timeAgo)}</Text>
                        </View>
                        <Text style={styles.nestedContent}>{reply.content}</Text>
                        <View style={styles.nestedActionsRow}>
                          <TouchableOpacity
                            style={styles.nestedReplyActionBtn}
                            onPress={() => handleReplyTo(comment.id, reply.author)}
                            activeOpacity={0.7}
                          >
                            <CornerDownRight size={11} color="#2563EB" />
                            <Text style={styles.nestedReplyActionText}>Balas</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Bottom Floating Comment Input Bar */}
        <View style={styles.inputContainer}>
          {replyingTo && (
            <View style={styles.replyingBanner}>
              <View style={styles.replyingTextRow}>
                <CornerDownRight size={13} color="#2563EB" />
                <Text style={styles.replyingText}>
                  Membalas ke <Text style={styles.replyingAuthor}>@{replyingTo.author}</Text>
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReplyingTo(null)}
                style={styles.cancelReplyBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Batalkan balasan"
              >
                <X size={15} color="#64748B" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.inputField}
              placeholder={
                replyingTo
                  ? `Tulis balasan untuk @${replyingTo.author}...`
                  : 'Tulis tanggapan atau masukan...'
              }
              placeholderTextColor="#94A3B8"
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!commentText.trim() || isSubmitting) && styles.sendBtnDisabled,
              ]}
              onPress={handleSendComment}
              activeOpacity={0.8}
              disabled={!commentText.trim() || isSubmitting}
            >
              <Send size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modal Edit Diskusi */}
      <CreatePostModal
        visible={isEditModalOpen}
        mode="edit"
        initialData={currentPost}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={async (data) => {
          await updatePost({
            id: currentPost.id,
            title: data.title,
            content: data.content,
            tag: data.tag,
            mediaUri: data.mediaUri,
            mediaType: data.mediaType,
          });
          setIsEditModalOpen(false);
        }}
      />

      {/* Modal Konfirmasi Hapus Diskusi */}
      <DeleteConfirmationModal
        visible={isDeleteModalVisible}
        title="Hapus Diskusi"
        postTitle={currentPost.title}
        message="Apakah Anda yakin ingin menghapus topik diskusi ini dari forum komunitas? Tindakan ini tidak dapat dibatalkan."
        isDeleting={isDeleting}
        onCancel={() => setIsDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadgeDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  mainPostCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  pinnedText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#B45309',
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  authorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
  },
  editPostText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  deletePostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  deletePostText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 25,
    marginBottom: 14,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EBA338',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  authorMeta: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  authorSchool: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
  postContent: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
    marginBottom: 16,
  },
  mediaContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
  },
  videoPlayerCard: {
    height: 180,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
  },
  playIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EBA338',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoNotice: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  postActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  actionButtonLiked: {
    backgroundColor: '#FEF2F2',
  },
  actionButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  actionButtonTextLiked: {
    color: '#EF4444',
  },
  commentsHeader: {
    paddingHorizontal: 4,
    gap: 3,
  },
  commentsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  commentsCountBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  commentsCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  commentsSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  commentsList: {
    gap: 12,
  },
  emptyCommentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyCommentsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  emptyCommentsSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  commentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  commentAuthorMeta: {
    flex: 1,
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  commentAuthorSchool: {
    fontSize: 11,
    color: '#64748B',
  },
  commentTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  commentContent: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 4,
  },
  commentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  commentActionText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  commentActionTextLiked: {
    color: '#EF4444',
  },
  replyButtonText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  nestedRepliesContainer: {
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#E2E8F0',
    gap: 10,
  },
  nestedReplyItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  nestedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nestedAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nestedAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  nestedAuthorMeta: {
    flex: 1,
  },
  nestedAuthorName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  nestedAuthorSchool: {
    fontSize: 10.5,
    color: '#64748B',
  },
  nestedTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  nestedContent: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  nestedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
  },
  nestedReplyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  nestedReplyActionText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
  },
  replyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 8,
  },
  replyingTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  replyingText: {
    fontSize: 12,
    color: '#1E40AF',
  },
  replyingAuthor: {
    fontWeight: '700',
  },
  cancelReplyBtn: {
    padding: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputField: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1E293B',
    maxHeight: 90,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EBA338',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
});
