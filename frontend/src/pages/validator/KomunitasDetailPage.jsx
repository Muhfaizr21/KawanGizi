import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  CornerDownRight,
  X,
  Share2,
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { useAuth } from '../../context/AuthContext'
import { PostCard } from '../../components/community/PostCard'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ToastNotice } from '../../components/ui/ToastNotice'
import {
  fetchPostByID,
  toggleLikePost,
  deletePost,
  createComment,
} from '../../lib/api'
import { navigate } from '../../App'

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function KomunitasDetailPage({ postId }) {
  const { user } = useAuth()

  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Reply state
  const [commentText, setCommentText] = useState('')
  const [replyingTo, setReplyingTo] = useState(null) // { id, author }
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Delete modal
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState(null)

  const commentInputRef = useRef(null)
  const commentsBottomRef = useRef(null)

  // Load post details
  const loadPost = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPostByID(postId)
      if (data) {
        setPost(data)
      } else {
        setError('Postingan tidak ditemukan atau telah dihapus.')
      }
    } catch (err) {
      console.error('Error fetching post detail:', err)
      setError('Gagal memuat rincian diskusi. Periksa koneksi Anda.')
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    loadPost()
  }, [loadPost])

  // Like toggle handler
  const handleLike = useCallback(
    async (targetPostId) => {
      if (!post) return
      // Optimistic update
      const nextLiked = !post.isLiked
      const nextCount = nextLiked
        ? (post.likesCount || 0) + 1
        : Math.max(0, (post.likesCount || 0) - 1)

      setPost((prev) => ({
        ...prev,
        isLiked: nextLiked,
        likesCount: nextCount,
      }))

      try {
        const res = await toggleLikePost(targetPostId)
        if (res) {
          setPost((prev) => ({
            ...prev,
            isLiked: res.isLiked,
            likesCount: res.likesCount,
          }))
        }
      } catch (err) {
        console.warn('Like sync error:', err)
      }
    },
    [post]
  )

  // Delete post handler
  const handleDeletePost = useCallback(async () => {
    if (!post) return
    setIsDeleting(true)
    try {
      await deletePost(post.id)
      navigate('/dashboard/komunitas')
    } catch (err) {
      setToast({
        tone: 'error',
        title: 'Gagal Menghapus',
        message: err?.message || 'Terjadi kesalahan saat menghapus postingan.',
      })
      setIsDeleting(false)
      setIsDeleteOpen(false)
    }
  }, [post])

  // Trigger reply mode
  const handleStartReply = (comment) => {
    setReplyingTo({
      id: comment.id,
      author: comment.author,
    })
    setTimeout(() => {
      commentInputRef.current?.focus()
    }, 100)
  }

  // Submit comment or reply
  const handleSubmitComment = async (e) => {
    e.preventDefault()
    const content = commentText.trim()
    if (!content || isSubmitting || !post) return

    setIsSubmitting(true)
    try {
      const payload = {
        content,
        parentId: replyingTo?.id || undefined,
      }
      const newComment = await createComment(post.id, payload)
      if (newComment) {
        setPost((prev) => {
          const currentComments = Array.isArray(prev.comments) ? prev.comments : []
          if (payload.parentId) {
            const updated = currentComments.map((c) => {
              if (c.id === payload.parentId) {
                return {
                  ...c,
                  replies: [...(c.replies || []), newComment],
                }
              }
              return c
            })
            return { ...prev, comments: updated }
          } else {
            return { ...prev, comments: [...currentComments, newComment] }
          }
        })
        setCommentText('')
        setReplyingTo(null)
        setToast({
          tone: 'success',
          title: 'Komentar terkirim',
          message: 'Tanggapan Anda telah ditambahkan ke dalam thread diskusi.',
        })
        // Scroll to bottom smoothly
        setTimeout(() => {
          commentsBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 150)
      }
    } catch (err) {
      setToast({
        tone: 'error',
        title: 'Gagal mengirim komentar',
        message: err?.message || 'Terjadi kesalahan.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const allComments = Array.isArray(post?.comments) ? post.comments : []
  const totalCommentsCount = allComments.reduce(
    (acc, c) => acc + 1 + (Array.isArray(c.replies) ? c.replies.length : 0),
    0
  )

  return (
    <ValidatorLayout
      activeMenu="community"
      hideBottomNav={true}
      title="Detail Diskusi Komunitas"
      subtitle="Ruang diskusi dan klarifikasi SOP antar validator & dapur SPPG."
      primaryAction={
        <button
          type="button"
          onClick={() => navigate('/dashboard/komunitas')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Forum</span>
        </button>
      }
    >
      <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-5 pb-36 md:pb-28">
        {/* ========================================================================= */}
        {/* STICKY TOP NAVIGATION BAR */}
        {/* ========================================================================= */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 bg-white/95 backdrop-blur-md border-b border-slate-100 flex items-center justify-between gap-3 shadow-xs">
          <button
            type="button"
            onClick={() => navigate('/dashboard/komunitas')}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-700 hover:text-[#185338] transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali</span>
          </button>

          <div className="text-center min-w-0 flex-1 px-2">
            <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
              {post?.title || 'Detail Postingan'}
            </h1>
            {post?.tag && (
              <p className="text-[10px] font-bold text-emerald-800">
                #{post.tag}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500">
              {totalCommentsCount} Komentar
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BODY: POST CARD OR LOADING / ERROR */}
        {/* ========================================================================= */}
        {loading ? (
          <div className="p-12 text-center rounded-[22px] bg-white border border-slate-200/80 shadow-xs space-y-3">
            <Loader2 className="h-7 w-7 animate-spin text-[#185338] mx-auto" />
            <p className="text-xs font-bold text-slate-500">
              Memuat detail postingan…
            </p>
          </div>
        ) : error || !post ? (
          <div className="p-8 text-center rounded-[22px] bg-white border border-rose-200 text-rose-700 shadow-xs space-y-3">
            <AlertCircle className="h-6 w-6 mx-auto text-rose-500" />
            <p className="text-xs font-bold">{error || 'Postingan tidak ditemukan.'}</p>
            <button
              type="button"
              onClick={() => navigate('/dashboard/komunitas')}
              className="px-4 py-1.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold hover:bg-rose-200 transition cursor-pointer"
            >
              Kembali ke Forum
            </button>
          </div>
        ) : (
          <>
            {/* Full Post Card View */}
            <PostCard
              post={post}
              currentUser={user}
              onLike={handleLike}
              onDelete={() => setIsDeleteOpen(true)}
              isDetailView={true}
            />

            {/* Comments Header */}
            <div className="pt-2 flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#185338]" />
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Tanggapan & Diskusi ({totalCommentsCount})
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Diurutkan berdasarkan waktu terbaru
              </span>
            </div>

            {/* Comments List */}
            {allComments.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  Belum ada komentar untuk topik ini.
                </p>
                <p className="text-[11px] text-slate-400">
                  Tuliskan tanggapan atau pengalaman Anda melalui formulir di bawah.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {allComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-2xl bg-white border border-slate-200/80 p-3.5 sm:p-4 shadow-xs space-y-2.5"
                  >
                    {/* Comment Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-7 w-7 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
                          {initialsOf(comment.author)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-slate-900 truncate">
                              {comment.author}
                            </span>
                            {comment.role && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 shrink-0">
                                {comment.role}
                              </span>
                            )}
                          </div>
                          {comment.school && (
                            <p className="text-[10px] text-slate-400 truncate">
                              {comment.school}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 shrink-0">
                        {comment.timeAgo || 'Baru saja'}
                      </span>
                    </div>

                    {/* Comment Content */}
                    <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line pl-9 leading-relaxed">
                      {comment.content}
                    </p>

                    {/* Action: Balas */}
                    <div className="flex items-center gap-3 pl-9 pt-0.5 text-xs font-bold text-slate-500">
                      <button
                        type="button"
                        onClick={() => handleStartReply(comment)}
                        className="inline-flex items-center gap-1 hover:text-[#185338] transition cursor-pointer select-none"
                      >
                        <CornerDownRight className="h-3.5 w-3.5 text-[#185338]" />
                        <span>Balas</span>
                      </button>
                    </div>

                    {/* Nested Replies */}
                    {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                      <div className="ml-9 mt-2 space-y-2 border-l-2 border-emerald-200/80 pl-3 pt-1">
                        {comment.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="p-3 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {initialsOf(reply.author)}
                                </div>
                                <span className="font-extrabold text-slate-900 truncate">
                                  {reply.author}
                                </span>
                                {reply.school && (
                                  <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                                    • {reply.school}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {reply.timeAgo || 'Baru saja'}
                              </span>
                            </div>
                            <p className="text-slate-700 whitespace-pre-line pl-8">
                              {reply.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div ref={commentsBottomRef} />
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FIXED STICKY BOTTOM COMMENT INPUT FORM */}
      {/* ========================================================================= */}
      {post && !loading && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 p-3 sm:p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="max-w-2xl mx-auto space-y-2">
            {/* Replying Banner */}
            {replyingTo && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 animate-in fade-in duration-150">
                <span className="truncate">
                  Membalas tanggapan <strong>@{replyingTo.author}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="p-1 text-emerald-800 hover:text-emerald-950 transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Input & Send Form */}
            <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0 hidden sm:flex">
                {initialsOf(user?.fullName || 'Validator')}
              </div>

              <input
                ref={commentInputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={
                  replyingTo
                    ? `Tulis balasan untuk @${replyingTo.author}...`
                    : 'Tulis komentar atau tanggapan Anda...'
                }
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#185338] focus:bg-white focus:ring-2 focus:ring-[#185338]/15"
                disabled={isSubmitting}
              />

              <button
                type="submit"
                disabled={!commentText.trim() || isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-3 rounded-2xl bg-[#123624] hover:bg-[#0e2c1d] text-white text-xs sm:text-sm font-extrabold transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Kirim</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        tone="danger"
        eyebrow="Hapus Postingan Komunitas"
        title="Hapus postingan ini?"
        description="Seluruh tanggapan dan komentar di dalam topik ini akan dihapus permanen dari forum komunitas KawanGizi."
        details={[
          `Judul: ${post?.title || '-'}`,
          'Tindakan ini tidak dapat dibatalkan.',
        ]}
        confirmLabel="Hapus Permanen"
        loading={isDeleting}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={handleDeletePost}
      />

      {/* Toast Notice */}
      <ToastNotice
        tone={toast?.tone}
        title={toast?.title}
        message={toast?.message}
        onDismiss={() => setToast(null)}
      />
    </ValidatorLayout>
  )
}

export default KomunitasDetailPage
