import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChronosLayer - Advanced Longevity Diagnostics',
  description: 'Precision clinical optimization, biomarker monitoring, and biological age assessment.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-50 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
