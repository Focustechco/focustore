import FavoritosPage from '../conta/favoritos/page';
import { Metadata } from 'next';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = {
  title: 'Meus Favoritos — Focus Store',
  description: 'Seus produtos favoritos e lista de desejos na Focus Store Oficial.',
};

export default FavoritosPage;
