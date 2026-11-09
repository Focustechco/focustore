import type { Metadata } from 'next';
import { Dela_Gothic_One, Inter } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { CartProvider } from '@/modules/cart/cart-context';
import { FavoritesProvider } from '@/modules/favorites/favorites-context';
import { CartDrawer } from '@/components/commerce/cart-drawer';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const delaGothicOne = Dela_Gothic_One({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-collection-display',
});

const unisonPro = localFont({
  src: './fonts/unison-pro-bold-italic.otf',
  display: 'swap',
  style: 'italic',
  weight: '700',
  variable: '--font-unison-pro',
});

export const metadata: Metadata = {
  title: 'Focus Store — Loja Oficial | Tecnologia, Design & Streetwear',
  description: 'Produtos exclusivos para quem vive tecnologia, criatividade e inovação. Streetwear, vestuário premium, garrafas térmicas e acessórios.',
  keywords: ['focus store', 'streetwear tech', 'camisas minimalistas', 'garrafas termicas', 'moletom tech', 'gadgets design'],
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Focus Store — Loja Oficial',
    description: 'Ideias também se usam. Produtos exclusivos para quem vive inovação.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`dark ${inter.variable} ${delaGothicOne.variable} ${unisonPro.variable}`}>
      <body className="bg-background text-white min-h-screen flex flex-col selection:bg-focus selection:text-white">
        <FavoritesProvider>
          <CartProvider>
            {children}
            <CartDrawer />
          </CartProvider>
        </FavoritesProvider>
      </body>
    </html>
  );
}