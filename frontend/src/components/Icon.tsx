import type { Category } from "../types/simulation";
type IconName =
  | Category
  | "arrow"
  | "check"
  | "city"
  | "close"
  | "spark"
  | "compare";
const paths: Record<IconName, React.ReactNode> = {
  transport: (
    <>
      <rect x="4" y="3" width="16" height="15" rx="3" />
      <path d="M4 11h16M8 3v8M16 3v8M7 18v3m10-3v3M7 15h1m8 0h1" />
    </>
  ),
  greening: (
    <>
      <path d="M20 3C7 2 2 8 5 15s15 6 15-12Z" />
      <path d="M3 22 15 10" />
    </>
  ),
  social: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M2 21v-4a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v4m1-17a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v4" />
    </>
  ),
  safety: (
    <>
      <path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  services: (
    <>
      <path d="M14 3a6 6 0 0 0-7 7l-5 5a3 3 0 0 0 4 4l5-5a6 6 0 0 0 7-7l-4 4-3-3Z" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  city: (
    <>
      <path d="M3 21V10h5v11M10 21V3h5v18m2 0V7h4v14M1 21h22" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  spark: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
    </>
  ),
  compare: (
    <>
      <path d="M4 3v18m16-18v18M8 7h8l-3-3m3 13H8l3 3" />
    </>
  ),
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
