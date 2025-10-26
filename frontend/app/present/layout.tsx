import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Presentation Mode | Lecture Gen",
  description: "Fullscreen presentation mode for Lecture Gen",
};

export default function PresentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // No header, no footer - just the children
    <>{children}</>
  );
}
