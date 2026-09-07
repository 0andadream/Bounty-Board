import { useNavigate } from 'react-router-dom'

export function goBack(navigate: ReturnType<typeof useNavigate>) {
  if (window.history.length > 1) navigate(-1)
  else navigate('/')
}

export function BackKey() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="back-key"
      aria-label="Go back"
      title="Go back (Esc)"
      onClick={() => goBack(navigate)}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
