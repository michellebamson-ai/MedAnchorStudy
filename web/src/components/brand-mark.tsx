/**
 * Brand mark (ONBOARDING_SPEC.md Pages 1-3).
 *
 * Renders public/brand/logo.svg, the anchor-and-wings emblem in glowing
 * cyan-teal on black. An earlier version pointed at an image that did not
 * exist and fired a 404 on every page load; a second version inlined a plain
 * anchor glyph as a stand-in. Neither matched the real artwork, and both are
 * now gone.
 *
 * The file is requested rather than inlined so it is cached once and reused
 * across every page, and so there is a single source of truth for the emblem
 * that the favicon and the social preview can be generated from.
 *
 * The emblem has a black background, so it is square: stretching it to a wide
 * box would distort the wings. `brandmark` handles the glow.
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
      className="brandmark"
      data-glow={glow}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo.svg"
        alt=""
        width={size}
        height={size}
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </span>
  );
}