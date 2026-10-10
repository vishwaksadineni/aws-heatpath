import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HeatPath — Find the Coolest Walking Route",
  description:
    "HeatPath uses real-time heat maps, shade data, water points, and AWS Bedrock AI to find the coolest, safest walking route for you.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
