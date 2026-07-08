export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M4.5 15.2 L16 4.5 L27.5 15.2 V27 H4.5 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M11.2 19.6 C11.2 17.9, 12.5 17.0, 13.7 17.4 C14.5 17.7, 15.3 18.3, 16 19.0 C16.7 18.3, 17.5 17.7, 18.3 17.4 C19.5 17.0, 20.8 17.9, 20.8 19.6 C20.8 21.5, 18.5 23.6, 16 25.6 C13.5 23.6, 11.2 21.5, 11.2 19.6 Z"
        fill="currentColor"
      />
    </svg>
  );
}
