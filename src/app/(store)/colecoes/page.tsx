import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Dela_Gothic_One } from "next/font/google";
import { ChevronRight, Sparkles, ArrowRight, Layers } from "lucide-react";
import { CatalogService } from "@/modules/catalog/catalog.service";
import { ProductCard } from "@/components/commerce/product-card";

const delaGothicOne = Dela_Gothic_One({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Coleções Exclusivas | FOCUS STORE®",
  description:
    "Descubra as coleções conceituais da FOCUS STORE®, incluindo a DEV COLLECTION e Focus Lab.",
};

export default async function CollectionsPage() {
  const collections = await CatalogService.getCollections();
  const allProducts = await CatalogService.getAllProducts();

  const devCollectionProducts = allProducts.filter((p) =>
    p.collections.some((c) => c.collection.slug === "dev-collection"),
  );

  const techProducts = allProducts.filter((p) =>
    p.collections.some(
      (c) =>
        c.collection.slug === "focus-tech" || c.collection.slug === "focus-lab",
    ),
  );

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-16">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-muted uppercase tracking-wider">
        <Link href="/" className="hover:text-white transition-colors">
          Início
        </Link>
        <ChevronRight size={14} />
        <span className="text-[#FF6500] font-semibold">Coleções</span>
      </nav>

      {/* Header */}
      <div className="border-b border-white/10 pb-8 space-y-3">
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
          Coleções{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-[#FF6500]">
            FOCUS®
          </span>
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
          Projetos conceituais e cápsulas exclusivas desenvolvidas com materiais
          nobres, tecnologia têxtil de ponta e acabamento refinado para quem
          busca máxima autenticidade.
        </p>
      </div>

      {/* =========================================================
          DESTAQUE PRINCIPAL: COLEÇÃO FOCUS LINGUAGENS DE PROGRAMAÇÃO (BANNER HERO)
          ========================================================= */}
      <section className="relative rounded-3xl overflow-hidden border border-[#FF6500]/30 bg-gradient-to-br from-[#1A0C00] via-[#0E0E0E] to-[#080808] p-6 sm:p-10 lg:p-14 shadow-[0_20px_50px_rgba(255,101,0,0.15)]">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-radial from-[#FF6500]/25 via-transparent to-transparent pointer-events-none blur-3xl" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <h2 className={`${delaGothicOne.className} font-collection-display text-3xl sm:text-4xl lg:text-5xl text-white leading-tight uppercase`}>
              edição <br></br>{" "}
              <span className="text-[#FF6500]">dev collection </span>
            </h2>

            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-xl">
              Uma coleção exclusiva inspirada nas principais linguagens de
              programação, unindo{" "}
              <strong className="text-white">
                tecnologia, estilo e personalidade
              </strong>
              . Peças modernas e minimalistas para quem vive o universo da
              programação e quer expressar sua paixão pela tecnologia.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/colecao/dev-collection"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-lg shadow-[#FF6500]/30 hover:scale-105 active:scale-95"
              >
                <span>Ver Coleção Completa</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Mini vitrine da DEV COLLECTION */}
          <div className="lg:col-span-6 grid grid-cols-3 gap-3 sm:gap-4">
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 bg-[#121212] group">
              <Image
                src="/images/camisas/01_Python_original.png?v=20261026-2"
                alt="Camisa Python"
                fill
                sizes="(max-width: 768px) 33vw, 15vw"
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                quality={90}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 sm:p-2.5">
                <span className="text-[10px] sm:text-xs font-bold text-white leading-tight">
                  T-Shirt
                </span>
              </div>
            </div>

            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 bg-[#121212] group">
              <Image
                src="/images/camisas/02_Java_alta_resolucao.png?v=20261026-2"
                alt="Camisa Java"
                fill
                sizes="(max-width: 768px) 33vw, 15vw"
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                quality={90}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 sm:p-2.5">
                <span className="text-[10px] sm:text-xs font-bold text-white leading-tight">
                  Polo
                </span>
              </div>
            </div>

            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 bg-[#121212] group">
              <Image
                src="/images/camisas/05_JavaScript_original.png?v=20261026-2"
                alt="Camisa JavaScript"
                fill
                sizes="(max-width: 768px) 33vw, 15vw"
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                quality={90}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 sm:p-2.5">
                <span className="text-[10px] sm:text-xs font-bold text-white leading-tight">
                  Boné
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          PRODUTOS DA DEV COLLECTION
          ========================================================= */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#FF6500]" />
              Itens Exclusivos • DEV COLLECTION
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Peças avulsas numeradas da coleção cápsula
            </p>
          </div>
          <Link
            href="/colecao/dev-collection"
            className="text-xs font-bold text-[#FF6500] hover:underline flex items-center gap-1 uppercase tracking-wider"
          >
            <span>Ver tudo</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {devCollectionProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* =========================================================
          PRODUTOS DA COLEÇÃO FOCUS TECH (TECHWEAR ESSENTIALS)
          ========================================================= */}
      <section className="space-y-6 pt-6 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              Coleção Focus Tech • Techwear Essentials
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              A essência do design minimalista, preto e branco com máxima
              performance
            </p>
          </div>
          <Link
            href="/colecao/focus-tech"
            className="text-xs font-bold text-[#FF6500] hover:underline flex items-center gap-1 uppercase tracking-wider"
          >
            <span>Ver tudo</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {techProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
