import { useState } from 'react'
import { MessageSquare, Send, CornerDownRight, Heart, Loader2 } from 'lucide-react'

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function CommentSection({
  postId,
  comments = [],
  onAddComment,
  currentUser,
}) {
  const [newCommentText, setNewCommentText] = useState('')
  const [replyingToId, setReplyingToId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSendComment = async (e) => {
    e.preventDefault()
    if (!newCommentText.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onAddComment(postId, { content: newCommentText.trim() })
      setNewCommentText('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendReply = async (commentId) => {
    if (!replyText.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onAddComment(postId, {
        content: replyText.trim(),
        parentId: commentId,
      })
      setReplyText('')
      setReplyingToId(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="pt-4 border-t border-slate-100 space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4 text-[#185338]" />
          <span>Diskusi ({comments.length})</span>
        </div>
      </div>

      {/* Write New Comment Box */}
      <form onSubmit={handleSendComment} className="flex gap-2.5 items-start">
        <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
          {initialsOf(currentUser?.fullName || 'Validator')}
        </div>
        <div className="flex-1 relative">
          <textarea
            rows={2}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Tulis tanggapan atau masukan SOP Anda..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#185338] focus:bg-white focus:ring-2 focus:ring-[#185338]/15 resize-none"
          />
          <div className="flex justify-end mt-1.5">
            <button
              type="submit"
              disabled={!newCommentText.trim() || isSubmitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#185338] hover:bg-[#123624] text-white text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Kirim</span>
            </button>
          </div>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-3 pt-2">
        {comments.map((comment) => (
          <div key={comment.id} className="space-y-2.5">
            {/* Parent Comment Card */}
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100/90 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {initialsOf(comment.author)}
                  </div>
                  <span className="font-bold text-slate-900 truncate">
                    {comment.author}
                  </span>
                  {comment.school && (
                    <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                      • {comment.school}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {comment.timeAgo || 'Baru saja'}
                </span>
              </div>

              <p className="text-slate-700 whitespace-pre-line pl-8">
                {comment.content}
              </p>

              <div className="flex items-center gap-3 pl-8 pt-1 text-[11px] font-semibold text-slate-500">
                <button
                  type="button"
                  onClick={() =>
                    setReplyingToId(
                      replyingToId === comment.id ? null : comment.id
                    )
                  }
                  className="hover:text-[#185338] transition cursor-pointer flex items-center gap-1"
                >
                  <CornerDownRight className="h-3 w-3" />
                  <span>Balas</span>
                </button>
              </div>
            </div>

            {/* Reply Form (When active) */}
            {replyingToId === comment.id && (
              <div className="ml-8 flex gap-2 items-start animate-in fade-in duration-150">
                <textarea
                  rows={2}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Balas komentar ${comment.author}...`}
                  className="flex-1 rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#185338] focus:ring-2 focus:ring-[#185338]/15 resize-none"
                  autoFocus
                />
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSendReply(comment.id)}
                    disabled={!replyText.trim() || isSubmitting}
                    className="px-3 py-1.5 rounded-lg bg-[#185338] text-white text-xs font-bold hover:bg-[#123624] transition disabled:opacity-50 cursor-pointer"
                  >
                    Kirim
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingToId(null)
                      setReplyText('')
                    }}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {/* Nested Replies */}
            {Array.isArray(comment.replies) && comment.replies.length > 0 && (
              <div className="ml-8 space-y-2 border-l-2 border-emerald-100 pl-3">
                {comment.replies.map((reply) => (
                  <div
                    key={reply.id}
                    className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-[9px] shrink-0">
                          {initialsOf(reply.author)}
                        </div>
                        <span className="font-bold text-slate-900 truncate">
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
                    <p className="text-slate-700 whitespace-pre-line pl-6">
                      {reply.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
