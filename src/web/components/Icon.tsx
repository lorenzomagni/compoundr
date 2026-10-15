import type { SVGProps } from "react";

// Small inline icon set (24px grid, 1.75 stroke). Decorative by default; pass a title to make one meaningful.
const PATHS = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.3-4.3",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M20 4v4h-4M4 20v-4h4",
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 13.5A8.5 8.5 0 0 1 10.5 3a8.5 8.5 0 1 0 10.5 10.5Z",
  check: "m5 12 5 5L20 7",
  x: "M6 6l12 12M18 6 6 18",
  alert: "M12 9v4m0 4h.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  info: "M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  arrowUp: "M12 19V5m-7 7 7-7 7 7",
  arrowDown: "M12 5v14m7-7-7 7-7-7",
  arrowRight: "M5 12h14m-7-7 7 7-7 7",
  bookmark: "M6 4h12v17l-6-4-6 4V4Z",
  camera: "M4 8h3l2-3h6l2 3h3v12H4V8Zm8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5",
  key: "M15 3a6 6 0 0 0-5.7 7.9L3 17.2V21h3.8l6.3-6.3A6 6 0 1 0 15 3Zm1 5h.01",
  shield: "M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z",
  scale: "M12 3v18M4 7h16M6 7l-3 7a4 4 0 0 0 6 0L6 7Zm12 0-3 7a4 4 0 0 0 6 0l-3-7Z",
  coins: "M8 11a5 2.5 0 1 0 10 0 5 2.5 0 1 0-10 0Zm0 0v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4M3 6a5 2.5 0 1 0 10 0A5 2.5 0 1 0 3 6Zm0 0v4c0 1.1 1.4 2 3.4 2.3",
  sparkle: "m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2L12 3Z",
  external: "M14 4h6v6m0-6-9 9M20 14v6H4V4h6",
  compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm3.5-13.5-2 5.5-5.5 2 2-5.5 5.5-2Z",
  clock: "M12 7v5l3 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, title, ...rest }: { name: IconName; size?: number; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
