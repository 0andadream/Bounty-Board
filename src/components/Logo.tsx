import { useId } from 'react'

const OUTER = 'M18 12 H60 L72 24 V46 L66 52 L74 58 V90 L60 106 H18 Z'
const HOLES =
  'M36 26 H56 L58 28 V44 L56 46 H36 Z M36 64 H56 L60 68 V88 L56 92 H36 Z'

export function Logo({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const hatch = `${uid}-hatch`
  const clip = `${uid}-clip`

  return (
    <svg
      className={className}
      viewBox="0 0 92 122"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Board"
      role="img"
    >
      <defs>
        <pattern
          id={hatch}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="8" height="8" fill="#07070a" />
          <line x1="0" y1="0" x2="8" y2="0" stroke="#d8ff3e" strokeWidth="2.5" />
        </pattern>
        <clipPath id={clip} clipPathUnits="userSpaceOnUse">
          <path d={`${OUTER} ${HOLES}`} fillRule="evenodd" />
        </clipPath>
      </defs>
      <g transform="translate(8 2) skewX(-8)">
        <rect x="28" y="0" width="16" height="12" fill="#d8ff3e" />
        <rect x="28" y="106" width="16" height="12" fill="#d8ff3e" />
        <rect width="90" height="120" fill={`url(#${hatch})`} clipPath={`url(#${clip})`} />
        <path d={OUTER} fill="none" stroke="#d8ff3e" strokeWidth="6.4" strokeLinejoin="miter" />
        <path d={OUTER} fill="none" stroke="#07070a" strokeWidth="3.6" strokeLinejoin="miter" />
        <path d={OUTER} fill="none" stroke="#d8ff3e" strokeWidth="1.6" strokeLinejoin="miter" />
        <path d={HOLES} fill="#07070a" fillRule="evenodd" />
        <path d={HOLES} fill="none" fillRule="evenodd" stroke="#d8ff3e" strokeWidth="2.2" />
        <text
          x="74"
          y="30"
          fill="#d8ff3e"
          fontFamily="Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
          fontSize="18"
          fontWeight="700"
        >
          $
        </text>
      </g>
    </svg>
  )
}
