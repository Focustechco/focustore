'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'A Focus Store tem loja física?',
    answer:
      'Operamos 100% de forma digital para entregar produtos exclusivos em todo o território nacional com frete ágil e seguro. Nossos encontros presenciais, eventos e pop-up stores da comunidade são anunciados com antecedência em nossas redes sociais.',
  },
  {
    question: 'Qual o prazo de entrega dos pedidos?',
    answer:
      'O prazo varia de acordo com o seu CEP e o frete selecionado no checkout (SEDEX Express ou Envio Padrão). Em média, capitais recebem entre 1 a 3 dias úteis e demais regiões de 3 a 7 dias úteis após a confirmação do pagamento.',
  },
  {
    question: 'Quais tecidos e materiais são utilizados nas peças Focus?',
    answer:
      'Utilizamos algodão nobre de alta gramatura (Heavyweight 260g a 380g), sarja estruturada premium em bonés e tecidos com corte streetwear e costuras reforçadas. Nossos itens de tecnologia e acessórios são fabricados em aço inoxidável 18/8 e ligas metálicas anodizadas.',
  },
  {
    question: 'Como funciona a política de trocas e devoluções?',
    answer:
      'Oferecemos a 1ª troca grátis em até 30 dias após o recebimento da sua encomenda. Se precisar trocar o tamanho ou modelo, nosso time de suporte gera uma etiqueta de logística reversa sem nenhum custo adicional para você.',
  },
  {
    question: 'As roupas da Focus encolhem ou desbotam após a lavagem?',
    answer:
      'Não. Nossas peças passam por processos industriais de pré-encolhimento e fixação de cor. Recomendamos lavar com água fria, do avesso e secar à sombra para máxima durabilidade do tecido e da estampa.',
  },
  {
    question: 'O que é a Linha Focus Lab?',
    answer:
      'Focus Lab é o núcleo criativo da marca dedicado ao desenvolvimento de drops limitados e conceitos inovadores de streetwear e techwear. São produtos lançados em tiragens reduzidas para quem vive tecnologia, código e inovação.',
  },
  {
    question: 'Quais são as formas de pagamento aceitas?',
    answer:
      'Aceitamos PIX com 10% de desconto imediato e aprovação em tempo real, além de cartões de crédito de todas as principais bandeiras com parcelamento em até 12x.',
  },
];

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 select-none">
      {/* Header Centralizado da Seção */}
      <div className="text-center space-y-2">
        <p className="text-xs font-bold text-[#FF6500] uppercase tracking-widest">
          Tire suas dúvidas
        </p>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase">
          PERGUNTAS FREQUENTES
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
          Tudo o que você precisa saber sobre produtos, materiais, envios e a comunidade Focus Store.
        </p>
      </div>

      {/* Lista Accordion */}
      <div className="divide-y divide-white/10 border-y border-white/10">
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div key={idx} className="group transition-colors">
              <button
                onClick={() => toggleItem(idx)}
                className="w-full py-5 flex items-center justify-between gap-4 text-left focus:outline-none"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      isOpen
                        ? 'bg-[#FF6500] text-white shadow-md shadow-[#FF6500]/30'
                        : 'bg-[#141414] border border-white/10 text-zinc-400 group-hover:text-white group-hover:border-white/30'
                    }`}
                  >
                    <HelpCircle size={15} />
                  </div>
                  <span
                    className={`text-sm sm:text-base font-bold transition-colors ${
                      isOpen ? 'text-[#FF6500]' : 'text-white group-hover:text-zinc-200'
                    }`}
                  >
                    {item.question}
                  </span>
                </div>

                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 transition-transform duration-300 ${
                    isOpen ? 'rotate-180 text-[#FF6500]' : 'group-hover:text-white'
                  }`}
                >
                  <ChevronDown size={18} />
                </div>
              </button>

              {/* Resposta Expansível */}
              {isOpen && (
                <div className="pb-5 pl-10 pr-4 text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal animate-fadeIn">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
