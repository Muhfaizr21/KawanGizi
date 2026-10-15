import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Loader2,
  AlertCircle,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { useAuth } from '../../context/AuthContext'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ToastNotice } from '../../components/ui/ToastNotice'
import { PostCard } from '../../components/community/PostCard'
import { CreatePostModal } from '../../components/community/CreatePostModal'
import { GlobalLoader } from '../../components/ui/GlobalLoader'
import {
  fetchPosts,
  createPost,
  deletePost,
  toggleLikePost,
  createComment,
} from '../../lib/api'

const TAG_FILTERS = [
  'Semua',
  'SOP Suhu',
  'Rekap Presensi',
  'Menu Alergi',
  'Pindai AI',
  'Distribusi',
  'Kebersihan',
]

export function KomunitasPage() {
  const { user } = useAuth()

  // Feed & Pagination state (10 item per page)
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // Filters & Search
  const [selectedTag, setSelectedTag] = useState('Semua')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deleteConfirmPost, setDeleteConfirmPost] = useState(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [toast, setToast] = useState(null)

  // Sentinel ref for infinite scroll
  const sentinelRef = useRef(null)

  // Load posts for a specific page
  const loadPosts = useCallback(
    async (pageNum = 1, isAppend = false, isSilent = false) => {
      if (isAppend) {
        setLoadingMore(true)
      } else if (!isSilent) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }
      setError(null)

      try {
        const data = await fetchPosts({
          page: pageNum,
          limit: 10,
          tag: selectedTag !== 'Semua' ? selectedTag : '',
          search: searchQuery.trim(),
        })

        const newItems = Array.isArray(data?.items) ? data.items : []
        setHasMore(Boolean(data?.hasMore))
        setPage(pageNum)

        if (isAppend) {
          setPosts((prev) => {
            // Avoid duplicate posts
            const existingIds = new Set(prev.map((p) => p.id))
            const unique = newItems.filter((p) => !existingIds.has(p.id))
            return [...prev, ...unique]
          })
        } else {
          setPosts(newItems)
        }
      } catch (err) {
        console.error('Error fetching posts:', err)
        setError('Gagal memuat postingan forum. Periksa koneksi Anda.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [selectedTag, searchQuery]
  )

  // Initial load and filter change
  useEffect(() => {
    loadPosts(1, false)
  }, [loadPosts])

  // Setup IntersectionObserver on sentinelRef for seamless infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first.isIntersecting && hasMore && !loading && !loadingMore) {
          loadPosts(page + 1, true)
        }
      },
      { threshold: 0.1, rootMargin: '120px' }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, page, loadPosts])

  // Optimistic Like Handler
  const handleLike = useCallback(
    async (postId) => {
      // 1. Optimistic UI update
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const nextLiked = !p.isLiked
            const nextCount = nextLiked
              ? (p.likesCount || 0) + 1
              : Math.max(0, (p.likesCount || 0) - 1)
            return { ...p, isLiked: nextLiked, likesCount: nextCount }
          }
          return p
        })
      )

      // 2. Real API call
      try {
        const res = await toggleLikePost(postId)
        if (res) {
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === postId) {
                return {
                  ...p,
                  isLiked: res.isLiked,
                  likesCount: res.likesCount,
                }
              }
              return p
            })
          )
        }
      } catch (err) {
        console.warn('Like sync error:', err)
      }
    },
    []
  )

  // Add Comment / Reply Handler
  const handleAddComment = useCallback(
    async (postId, payload) => {
      try {
        const newComment = await createComment(postId, payload)
        if (newComment) {
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === postId) {
                const currentComments = Array.isArray(p.comments) ? p.comments : []
                if (payload.parentId) {
                  // Reply to existing comment
                  const updatedComments = currentComments.map((c) => {
                    if (c.id === payload.parentId) {
                      return {
                        ...c,
                        replies: [...(c.replies || []), newComment],
                      }
                    }
                    return c
                  })
                  return { ...p, comments: updatedComments }
                } else {
                  // Top-level comment
                  return { ...p, comments: [...currentComments, newComment] }
                }
              }
              return p
            })
          )
          setToast({
            tone: 'success',
            title: 'Komentar terkirim',
            message: 'Tanggapan Anda telah ditambahkan ke diskusi.',
          })
        }
      } catch (err) {
        setToast({
          tone: 'error',
          title: 'Gagal mengirim komentar',
          message: err?.message || 'Terjadi kesalahan sistem.',
        })
      }
    },
    []
  )

  // Create Post Submit Handler
  const handleCreatePost = useCallback(
    async (payload) => {
      const created = await createPost(payload)
      if (created) {
        // Prepend to top of feed immediately
        setPosts((prev) => [created, ...prev])
        setToast({
          tone: 'success',
          title: 'Postingan Diterbitkan',
          message: 'Topik diskusi baru berhasil dibagikan ke komunitas MBG.',
        })
      }
    },
    []
  )

  // Delete Post Handlers
  const handleDeletePost = useCallback(async () => {
    if (!deleteConfirmPost) return
    setDeletingBusy(true)
    try {
      await deletePost(deleteConfirmPost.id)
      setPosts((prev) => prev.filter((p) => p.id !== deleteConfirmPost.id))
      setDeleteConfirmPost(null)
      setToast({
        tone: 'success',
        title: 'Postingan Dihapus',
        message: 'Topik diskusi telah berhasil dihapus dari forum.',
      })
    } catch (err) {
      setToast({
        tone: 'error',
        title: 'Gagal Menghapus',
        message: err?.message || 'Terjadi kesalahan.',
      })
    } finally {
      setDeletingBusy(false)
    }
  }, [deleteConfirmPost])

  return (
    <ValidatorLayout
      activeMenu="community"
      title="Forum Komunitas"
      subtitle="Ruang diskusi, praktik baik & koordinasi SOP nutrisi antar validator dan dapur SPPG se-Indonesia."
      primaryAction={
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-xs font-extrabold bg-[#123624] hover:bg-[#0e2c1d] text-white transition shadow-sm cursor-pointer active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Buat Postingan Baru</span>
        </button>
      }
    >
      <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-5 pb-24 md:pb-12">
        {/* ========================================================================= */}
        {/* HERO BANNER CARD (Dark Green identity bg-[#123624]) */}
        {/* ========================================================================= */}
        <div className="rounded-[22px] sm:rounded-[26px] bg-[#123624] text-white p-5 sm:p-6 shadow-md border border-emerald-950/20 relative overflow-hidden">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                FORUM KOMUNITAS RESMI
              </span>
            </div>

            <div>
              <h1 className="text-base sm:text-xl font-extrabold text-white leading-snug">
                Ruang Kolaborasi Validator & SPPG
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-xl leading-relaxed">
                Bagikan catatan penanganan porsi, kendala suhu, serta inovasi tata kelola nutrisi sekolah Anda di sini.
              </p>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#123624] hover:bg-emerald-50 text-xs sm:text-sm font-extrabold transition shadow-sm cursor-pointer active:scale-95"
              >
                <Plus className="h-4 w-4 text-[#123624]" />
                <span>Buat Postingan Baru</span>
              </button>
            </div>
          </div>

          <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* ========================================================================= */}
        {/* SEARCH BAR */}
        {/* ========================================================================= */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari diskusi, SOP, lauk, atau nama validator..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200/80 bg-white text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#185338] focus:ring-2 focus:ring-[#185338]/15 shadow-xs"
          />
        </div>

        {/* ========================================================================= */}
        {/* TAG FILTER CHIPS (Horizontal Scrollable) */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-extrabold select-none">
          {TAG_FILTERS.map((t) => {
            const isActive = selectedTag === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTag(t)}
                className={`px-3.5 py-1.5 rounded-full transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#185338] text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                }`}
              >
                {t}
              </button>
            )
          })}
        </div>

        {/* ========================================================================= */}
        {/* POSTS FEED LIST */}
        {/* ========================================================================= */}
        {loading ? (
          <div className="p-12 text-center rounded-[22px] bg-white border border-slate-200/80 shadow-xs">
            <GlobalLoader label="Memuat postingan komunitas…" />
          </div>
        ) : error ? (
          <div className="p-8 text-center rounded-[22px] bg-white border border-rose-200 text-rose-700 shadow-xs space-y-3">
            <AlertCircle className="h-6 w-6 mx-auto text-rose-500" />
            <p className="text-xs font-bold">{error}</p>
            <button
              type="button"
              onClick={() => loadPosts(1, false)}
              className="px-4 py-1.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold hover:bg-rose-200 transition cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center rounded-[22px] bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-[#185338] flex items-center justify-center mx-auto">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-800">
              Belum Ada Postingan
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Jadilah yang pertama memulai diskusi untuk topik ini di komunitas KawanGizi.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#123624] text-white text-xs font-extrabold hover:bg-[#0e2c1d] transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Mulai Diskusi</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={user}
                onLike={handleLike}
                onDelete={(target) => setDeleteConfirmPost(target)}
                onAddComment={handleAddComment}
              />
            ))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* INFINITE SCROLL SENTINEL & LOAD MORE BUTTON */}
        {/* ========================================================================= */}
        <div ref={sentinelRef} className="py-4 text-center">
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#185338]" />
              <span>Memuat 10 postingan berikutnya…</span>
            </div>
          )}

          {!loading && !loadingMore && hasMore && posts.length > 0 && (
            <button
              type="button"
              onClick={() => loadPosts(page + 1, true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <span>Muat Lebih Banyak Postingan</span>
            </button>
          )}

          {!loading && !hasMore && posts.length > 0 && (
            <p className="text-xs font-medium text-slate-400">
              ✓ Seluruh postingan komunitas telah ditampilkan ({posts.length} topik)
            </p>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}
      <CreatePostModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreatePost}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmPost)}
        tone="danger"
        eyebrow="Hapus Postingan Komunitas"
        title="Hapus postingan ini?"
        description="Postingan ini beserta seluruh tanggapan dan komentar di dalamnya akan dihapus permanen dari forum komunitas KawanGizi."
        details={[
          `Judul: ${deleteConfirmPost?.title || '-'}`,
          `Kategori: #${deleteConfirmPost?.tag || '-'}`,
          'Tindakan ini tidak dapat dibatalkan.',
        ]}
        confirmLabel="Hapus Permanen"
        loading={deletingBusy}
        onCancel={() => setDeleteConfirmPost(null)}
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

export default KomunitasPage
