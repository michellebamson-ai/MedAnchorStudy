import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./tokens.css";
import "./components.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/*
          Apply the saved theme before first paint so a light-theme user never
          sees a dark flash. Deliberately inline and tiny — this runs ahead of
          hydration, so it cannot depend on React.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("medanchor-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
