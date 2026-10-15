import { useState } from 'react'
import {
  Heart,
  MessageCircle,
  Pin,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { CommentSection } from './CommentSection'
import { navigate } from '../../App'

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function PostCard({
  post,
  currentUser,
  onLike,
  onDelete,
  onAddComment,
  isDetailView = false,
  showInlineComments = false,
}) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(showInlineComments)
  const [isExpanded, setIsExpanded] = useState(isDetailView)

  const isLiked = Boolean(post.isLiked)
  const likesCount = post.likesCount || 0
  const commentsCount = Array.isArray(post.comments)
    ? post.comments.reduce(
        (acc, c) => acc + 1 + (Array.isArray(c.replies) ? c.replies.length : 0),
        0
      )
    : 0

  const isAuthor =
    (currentUser?.id && post.authorId === currentUser.id) ||
    currentUser?.role === 'superadmin' ||
    (currentUser?.fullName && post.author === currentUser.fullName)

  const contentText = post.content || ''
  const isLongContent = contentText.length > 280
  const displayedContent =
    isDetailView || isExpanded || !isLongContent
      ? contentText
      : contentText.slice(0, 280) + '…'

  const handleCardClick = (e) => {
    if (isDetailView) return
    // Ignore clicks on buttons or links
    if (e.target.closest('button') || e.target.closest('a')) {
      return
    }
    navigate('/dashboard/komunitas/' + post.id)
  }

  return (
    <article
      onClick={handleCardClick}
      className={`rounded-[22px] bg-white border border-slate-200/80 p-4 sm:p-5 shadow-xs transition space-y-3.5 ${
        isDetailView
          ? ''
          : 'cursor-pointer hover:border-emerald-300 hover:shadow-sm group'
      }`}
    >
      {/* Top Header: Author Avatar + Name + Role Badge + Meta + Delete */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar Initials Badge */}
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 border border-emerald-200/80 flex items-center justify-center font-black text-xs sm:text-sm text-emerald-900 shrink-0 shadow-xs">
            {initialsOf(post.author)}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                {post.author}
              </h2>

              {/* Role Badge in Emerald (Strictly NO orange/amber) */}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0">
                {post.role || 'Guru Validator'}
              </span>

              {post.isPinned && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#185338] text-white shrink-0">
                  <Pin className="h-2.5 w-2.5" />
                  <span>Disematkan</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
              <span className="truncate max-w-[200px]">{post.school || 'SDN Menteng 01 Pagi'}</span>
              <span>•</span>
              <time className="shrink-0">{post.timeAgo || 'Baru saja'}</time>
            </div>
          </div>
        </div>

        {/* Delete Post Button (Author / Superadmin only) */}
        {isAuthor && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(post)
            }}
            aria-label="Hapus postingan"
            title="Hapus postingan"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tag Badge */}
      {post.tag && (
        <div>
          <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60">
            #{post.tag}
          </span>
        </div>
      )}

      {/* Post Title */}
      {post.title && (
        <h3
          className={`text-sm sm:text-base font-extrabold leading-snug ${
            isDetailView
              ? 'text-slate-900'
              : 'text-slate-900 group-hover:text-[#185338] transition-colors'
          }`}
        >
          {post.title}
        </h3>
      )}

      {/* Post Text Body */}
      <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
        {displayedContent}
      </p>

      {/* Expand/Collapse Toggle if Long (only in feed view) */}
      {!isDetailView && isLongContent && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#185338] hover:underline cursor-pointer"
        >
          <span>{isExpanded ? 'Tampilkan lebih sedikit' : 'Lihat selengkapnya'}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      )}

      {/* Optional Attached Media Image */}
      {post.mediaUri && (
        <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-100 max-h-80 group/img">
          <img
            src={post.mediaUri}
            alt={post.title || 'Foto Postingan'}
            className="w-full h-auto max-h-80 object-cover transition-transform duration-300 group-hover/img:scale-[1.01]"
            loading="lazy"
          />
        </div>
      )}

      {/* Bottom Action Bar: Like & Comments */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Like / Suka Button (turns dark green when liked) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onLike?.(post.id)
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer select-none active:scale-95 ${
              isLiked
                ? 'bg-emerald-50 text-[#185338] font-extrabold border border-emerald-200/80'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
            }`}
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                isLiked ? 'fill-[#185338] text-[#185338]' : 'text-slate-400'
              }`}
            />
            <span>{isLiked ? 'Disukai' : 'Suka'}</span>
            <span className="ml-0.5 text-[11px] font-mono opacity-80">
              ({likesCount})
            </span>
          </button>

          {/* Comment / Komentar Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (!isDetailView) {
                // Navigate to detail view
                navigate('/dashboard/komunitas/' + post.id)
              } else {
                setIsCommentsOpen(!isCommentsOpen)
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/60 transition cursor-pointer select-none active:scale-95 ${
              isCommentsOpen || isDetailView
                ? 'bg-[#185338] text-white border-[#185338]'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            <span>Komentar</span>
            <span className="ml-0.5 text-[11px] font-mono opacity-80">
              ({commentsCount})
            </span>
          </button>
        </div>
      </div>

      {/* Expandable Comments Section (if enabled) */}
      {!isDetailView && isCommentsOpen && (
        <CommentSection
          postId={post.id}
          comments={post.comments || []}
          onAddComment={onAddComment}
          currentUser={currentUser}
        />
      )}
    </article>
  )
}

export default PostCard
