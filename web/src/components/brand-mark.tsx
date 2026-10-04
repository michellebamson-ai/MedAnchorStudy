/**
 * Brand mark (ONBOARDING_SPEC.md Pages 1–3).
 *
 * Renders inline SVG rather than requesting an image file. An earlier version
 * pointed at `public/brand/anchor-logo.png` and fell back on error, which meant
 * every page load fired a 404 for artwork that does not exist yet.
 *
 * To use the real anchor-and-snake artwork, drop it at
 * `public/brand/anchor-logo.png` and swap the `<svg>` below for:
 *
 *   <Image src="/brand/anchor-logo.png" alt="" width={size} height={size}
 *          priority style={{ width: "100%", height: "100%", objectFit: "contain" }} />
 */
export function BrandMark({
  size = 120,
  glow = false,
  label = "MedAnchor Study logo",
}: {
  size?: number;
  glow?: boolean;
  label?: string;
}) {
  return (
    <span
      className="brandmark brandmark-fallback"
      data-glow={glow}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2BB3BA" />
            <stop offset="1" stopColor="#0E7490" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="14" r="6" fill="none" stroke="url(#bm-g)" strokeWidth="3.5" />
        <line x1="32" y1="20" x2="32" y2="52" stroke="url(#bm-g)" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="22" y1="27" x2="42" y2="27" stroke="url(#bm-g)" strokeWidth="3.5" strokeLinecap="round" />
        <path
          d="M12 40 C12 50 20 55 32 55 C44 55 52 50 52 40"
          fill="none"
          stroke="url(#bm-g)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <line x1="12" y1="36" x2="12" y2="42" stroke="url(#bm-g)" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="52" y1="36" x2="52" y2="42" stroke="url(#bm-g)" strokeWidth="3.5" strokeLinecap="round" />
        <path
          d="M36 22 C40 28 40 34 36 40 C34 43 34 47 37 50"
          fill="none"
          stroke="#6FD3D6"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
