import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export const metadata = { title: "Welcome" };

/**
 * Page 1: Welcome Screen (ONBOARDING_SPEC.md).
 * Brand only, one action: Get Started. No menu, no search, no sign-in line.
 */
export default function WelcomePage() {
  return (
    <div className="onboard">
      <div className="onboard-inner">
        <div className="onboard-logo">
          <BrandMark size={132} glow label="MedAnchor Study logo" />
        </div>

        <h1 className="onboard-name">
          MedAnchor
          <br />
          <span className="teal">Study</span>
        </h1>
        <p className="onboard-slogan">Study it. Practice it. Anchor it.</p>

        <div className="onboard-gap" />

        <div className="onboard-cta">
          <Link
            className="btn-brand"
            href="/login"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
          >
            Get Started
          </Link>
        </div>

        <div className="onboard-dots" aria-label="Page 1 of 3">
          <i data-on="true" />
          <i data-on="false" />
          <i data-on="false" />
        </div>
      </div>
    </div>
  );
}
