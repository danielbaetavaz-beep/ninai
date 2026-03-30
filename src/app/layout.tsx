import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ninAI',
  description: 'Seu plano nutricional inteligente',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1D9E75',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#F7F6F3]" style={{ minHeight: '100dvh' }}>
        <div className="max-w-md mx-auto bg-white" style={{ minHeight: '100dvh' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
