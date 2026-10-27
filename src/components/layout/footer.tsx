import React from "react";
import Link from "next/link";
import { ShieldCheck, Truck } from "lucide-react";
import { FocusLogo } from "@/components/ui/focus-logo";
import { CurrentYear } from "./current-year";

export function Footer() {
  return (
    <footer className="bg-[#050505] border-t border-white/10 text-zinc-400 pt-16 pb-12 text-xs">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-white/10">
          {/* Coluna Marca */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <FocusLogo size="lg" />
            </Link>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
              Mais que produtos. Tecnologia para pessoas que transformam ideias
              em impacto real. Streetwear, design e lifestyle oficial.
            </p>
            <div className="flex items-center gap-4 text-white/70 pt-2">
              <a
                href="https://www.instagram.com/focustech.co/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#FF6500] transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://www.youtube.com/@Focustechco"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#FF6500] transition-colors"
                aria-label="YouTube"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a
                href="https://www.tiktok.com/@focustech.co?_r=1&_t=ZS-9AbzzjWDhuS"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#FF6500] transition-colors"
                aria-label="TikTok"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M16.6 3c.3 1.7 1.4 3.1 3.1 3.8v2.7c-1.1 0-2.1-.3-3.1-.8V14c0 3-2.4 5.4-5.4 5.4S5.8 17 5.8 14s2.4-5.4 5.4-5.4c.3 0 .6 0 .9.1V11c-.3-.1-.6-.1-.9-.1-1.8 0-3.2 1.4-3.2 3.2S9.4 17.3 11.2 17.3s3.2-1.4 3.2-3.2V3h2.2z" />
                </svg>
              </a>
              <a
                href="https://br.pinterest.com/focustechco/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#FF6500] transition-colors"
                aria-label="Pinterest"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.375-.293 1.199-.334 1.366-.053.225-.177.272-.409.165-1.523-.709-2.472-2.936-2.472-4.726 0-3.854 2.8-7.394 8.077-7.394 4.241 0 7.536 3.022 7.536 7.062 0 4.215-2.657 7.607-6.345 7.607-1.239 0-2.404-.644-2.804-1.407l-.762 2.906c-.276 1.062-1.023 2.394-1.524 3.208 1.16.357 2.39.551 3.666.551 6.627 0 12-5.373 12-12S18.627 0 12 0z" />
                </svg>
              </a>
              <a
                href="https://x.com/Focustechco"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#FF6500] transition-colors"
                aria-label="X (Twitter)"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Coluna Institucional */}
          <div className="space-y-3">
            <h4 className="text-white font-bold tracking-wider uppercase text-xs">
              Institucional
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="https://www.focustecnologias.com.br/#about"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Sobre a Focus
                </Link>
              </li>
              <li>
                <Link
                  href="https://api.whatsapp.com/send/?phone=558586674561&text&type=phone_number&app_absent=0"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Contato & Suporte
                </Link>
              </li>
              <li>
                <Link
                  href="/carreiras"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Carreiras
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/dashboard"
                  className="text-[#FF6500] font-semibold hover:underline"
                >
                  Painel Admin
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna Atendimento */}
          <div className="space-y-3">
            <h4 className="text-white font-bold tracking-wider uppercase text-xs">
              Atendimento
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/ajuda"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Central de Ajuda
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Perguntas Frequentes
                </Link>
              </li>
              <li>
                <Link
                  href="/rastreio"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Rastrear Pedido
                </Link>
              </li>
              <li>
                <Link
                  href="/politicas/trocas-devolucoes"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Trocas e Devoluções
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna Políticas */}
          <div className="space-y-3">
            <h4 className="text-white font-bold tracking-wider uppercase text-xs">
              Políticas
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/politicas/privacidade"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Privacidade & LGPD
                </Link>
              </li>
              <li>
                <Link
                  href="/politicas/termos"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link
                  href="/politicas/cookies"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Configuração de Cookies
                </Link>
              </li>
              <li>
                <Link
                  href="/seguranca"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Segurança de Dados
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Rodapé Bottom */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
          <p>
            © <CurrentYear /> Focus Store Oficial®. Todos os direitos
            reservados.
          </p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" /> Compra 100%
              Segura
            </span>
            <span className="flex items-center gap-1.5">
              <Truck size={14} className="text-[#FF6500]" /> Entrega em todo o
              Brasil
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
