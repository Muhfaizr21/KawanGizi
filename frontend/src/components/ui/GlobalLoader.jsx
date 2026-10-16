import Image from 'next/image'
import KawangiziLogo from '@/assets/kawangizi-logo.webp'

/**
 * GlobalLoader - Branded loading overlay & component for KawanGizi.
 * Features an animated breathing/pulsing official logo with zero artificial delay.
 *
 * @param {Object} props
 * @param {string} [props.label="Memuat KawanGizi..."] - Optional loading message.
 * @param {boolean} [props.fullScreen=false] - Whether to render as a full-screen overlay/page.
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Dimensions of the logo.
 * @param {boolean} [props.showText=true] - Whether to display the text label.
 * @param {string} [props.className=''] - Additional container classes.
 */
export function GlobalLoader({
  label = 'Memuat KawanGizi...',
  fullScreen = false,
  size = 'md',
  showText = true,
  className = '',
}) {
  const sizeMap = {
    sm: { img: 'h-8 w-8', dim: 32 },
    md: { img: 'h-14 w-14 sm:h-16 sm:w-16', dim: 64 },
    lg: { img: 'h-20 w-20 sm:h-24 sm:w-24', dim: 96 },
  }

  const currentSize = sizeMap[size] || sizeMap.md

  const containerClasses = fullScreen
    ? 'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm'
    : 'flex flex-col items-center justify-center py-12 px-4 w-full'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`${containerClasses} ${className}`}
    >
      <div className="relative flex items-center justify-center">
        {/* Soft emerald glowing aura behind the logo */}
        <div
          className="absolute -inset-4 rounded-full bg-emerald-500/15 blur-xl animate-pulse pointer-events-none"
          aria-hidden="true"
        />

        {/* Pulsing official KawanGizi brand logo */}
        <div className="relative z-10 animate-pulse transition-transform duration-300 ease-in-out">
          <Image
            src={KawangiziLogo}
            alt="Logo KawanGizi"
            width={currentSize.dim}
            height={currentSize.dim}
            className={`object-contain ${currentSize.img} drop-shadow-xs`}
            priority
          />
        </div>
      </div>

      {showText && (
        <div className="mt-4 flex flex-col items-center gap-1.5 z-10 text-center">
          <p className="text-xs font-semibold tracking-wide text-slate-700 font-sans">
            {label}
          </p>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-bounce" />
          </div>
        </div>
      )}
    </div>
  )
}

export default GlobalLoader
