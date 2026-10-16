export default function Image({
  src,
  alt = '',
  width,
  height,
  className = '',
  priority = false,
  loading,
  ...props
}) {
  // Support both string URL and imported asset object
  const imageSrc = typeof src === 'object' && src !== null ? (src.src || src.default || src) : src

  return (
    <img
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading || (priority ? 'eager' : 'lazy')}
      decoding="async"
      {...props}
    />
  )
}

export { Image }
