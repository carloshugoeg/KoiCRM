import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "koi-crm",
  description: "White-label multitenant CRM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
