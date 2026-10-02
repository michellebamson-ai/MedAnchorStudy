import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { isBypassOn } from "@/lib/bypass";
import "./tokens.css";
import "./components.css";

// Two-font system: a calm editorial serif carries page titles, major section
// headings and learning statements; Geist stays the primary interface font.
const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const newsreader = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MedAnchor Study",
    template: "%s | MedAnchor Study",
  },
  description:
    "An AI-powered learning workspace for healthcare and health-sciences students.",
};

export const viewport: Viewport = {
  themeColor: "#04342c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Light is the default in tokens.css, so a first-time visitor needs no
          JavaScript at all. This only restores an explicit dark choice, and it
          runs before paint so the toggle never flashes. Deliberately inline:
          it executes ahead of hydration, so it cannot depend on React.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("medanchor-theme")==="dark"){document.documentElement.dataset.theme="dark"}}catch(e){}`,
          }}
        />
      </head>
      <body>
        {isBypassOn() ? (
          <div
            style={{
              background: "#a8740c",
              color: "#fff",
              textAlign: "center",
              fontSize: "0.75rem",
              padding: "4px 8px",
              fontWeight: 600,
            }}
          >
            Demo mode — sign-in is bypassed (BYPASS_AUTH=1 in web/.env). Delete that line to
            re-enable auth.
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
