// Visually reviewed local assets. Run without --apply for a preview.
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const mappings = {
  'moletom-focus-hoodie': [
    ['Modelo-moletom-preto.webp', 'Preto', 'moletom vestido por modelo'],
    ['Moletom-preto-v2.png', 'Preto', 'vista frontal sem modelo'],
    ['moletom-focus-preto-frente-angulo.png', 'Preto', 'vista frontal em ângulo'],
    ['moletom-focus-preto-tres-quartos.png', 'Preto', 'vista em três quartos'],
    ['moletom-focus-preto-costas.png', 'Preto', 'vista traseira com capuz'],
    ['Modelo-moletom-Branco.webp', 'Branco', 'moletom vestido por modelo'],
    ['Moletom-focus-branco.png', 'Branco', 'vista frontal sem modelo'],
    ['moletom-focus-branco-perfil.png', 'Branco', 'vista em perfil'],
    ['moletom-focus-branco-costas.png', 'Branco', 'vista traseira com capuz'],
    ['moletom-focus-branco-frente-angulo.png', 'Branco', 'vista frontal em ângulo'],
  ],
  'camisa-focus-lab': [
    ['Camiseta-focus.png', 'Preto', 'camiseta vestida por modelo'],
    ['camiseta-focus-preta-v2.png', 'Preto', 'vista frontal sem modelo'],
    ['camiseta-focus-preta-costas.png', 'Preto', 'costas em três quartos'],
    ['camiseta-focus-preta-perfil.png', 'Preto', 'vista lateral em perfil'],
    ['camiseta-focus-preta-deitada.png', 'Preto', 'frente deitada com logo Focus'],
  ],
  'caderno-focus': [
    ['caderno-focus.png', 'Preto', 'capa principal com detalhes laranja'],
    ['caderno-focus-preto-superior.png', 'Preto', 'capa vista de cima com marcador laranja'],
    ['caderno-focus-preto-contracapa.png', 'Preto', 'contracapa com detalhes laranja'],
    ['caderno-focus-preto-frente-lombada.png', 'Preto', 'vista frontal com lombada à esquerda'],
    ['caderno-focus-preto-frente-porta-caneta.png', 'Preto', 'vista frontal com porta-caneta e borda laranja'],
  ],
  'bone-focus-lab': [['bone-focus.jpg', 'Preto', 'frente com símbolo Focus']],
  'bone-focus-signature': [
    ['bone-focus-signature.png', 'Preto', 'frente'],
    ['bone-focus-signature-preto-superior.png', 'Preto', 'vista frontal superior com bordado'],
    ['bone-focus-signature-preto-lateral-aba-direita.png', 'Preto', 'lateral com aba à direita'],
    ['bone-focus-signature-preto-lateral-aba-esquerda.png', 'Preto', 'lateral com aba à esquerda'],
    ['bone-focus-signature-preto-traseira.png', 'Preto', 'traseira com fivela metálica'],
    ['bone-focus-white.png', 'Branco', 'frente'],
    ['bone-focus-signature-branco-superior.png', 'Branco', 'vista frontal superior com bordado'],
    ['bone-focus-signature-branco-lateral-aba-direita.png', 'Branco', 'lateral com aba à direita'],
    ['bone-focus-signature-branco-lateral-aba-esquerda.png', 'Branco', 'lateral com aba à esquerda'],
    ['bone-focus-signature-branco-traseira.png', 'Branco', 'traseira com fivela metálica'],
  ],
  'caneca-focus-lab': [
    ['caneca-focus.png', 'Preto', 'produto isolado'],
    ['caneca-focus-preta-frontal.png', 'Preto', 'vista frontal com símbolo laranja'],
    ['caneca-focus-preta-lateral.png', 'Preto', 'vista lateral com alça em destaque'],
    ['caneca-focus-preta-superior.png', 'Preto', 'vista de cima mostrando o interior'],
  ],
  'garrafa-termica-focus': [
    ['garrafa-focus.png', 'Preto Fosco', 'produto isolado'],
    ['garrafa-focus-preta-frontal.png', 'Preto Fosco', 'vista frontal em ângulo com logo Focus'],
    ['garrafa-focus-preta-superior.png', 'Preto Fosco', 'vista superior em ângulo com tampa e alça'],
    ['garrafa-focus-preta-traseira.png', 'Preto Fosco', 'vista traseira sem logo'],
  ],
  'copo-termico-focus': [
    ['copo-termico-focus.png', 'Laranja Focus', 'produto isolado'],
    ['copo-termico-focus-laranja-base.png', 'Laranja Focus', 'vista da base'],
    ['copo-termico-focus-laranja-superior.png', 'Laranja Focus', 'vista de cima mostrando o interior metálico'],
    ['copo-termico-focus-laranja-traseira.png', 'Laranja Focus', 'vista traseira sem logo'],
  ],
  'kit-canetas-focus': [
    ['kit-canetas-focus.png', 'Laranja Focus', 'kit na embalagem'],
    ['kit-canetas-focus-laranja-detalhe.png', 'Laranja Focus', 'detalhe de uma caneta com logo e clipe metálico'],
    ['kit-canetas-focus-laranja-alinhadas.png', 'Laranja Focus', 'três canetas alinhadas horizontalmente'],
    ['kit-canetas-focus-laranja-diagonal.png', 'Laranja Focus', 'três canetas em diagonal'],
  ],
  'mousepad-focus': [
    ['Mousepad-Focus.png', 'Laranja Focus', 'produto isolado'],
    ['mousepad-focus-laranja-superior.png', 'Laranja Focus', 'vista de cima com logo Focus'],
    ['mousepad-focus-laranja-canto-levantado.png', 'Laranja Focus', 'canto levantado mostrando a base preta'],
    ['mousepad-focus-laranja-perspectiva.png', 'Laranja Focus', 'vista em perspectiva baixa'],
  ],
  'moletom-focus-lab': [['Polo-FocusModelo.png','Preto','polo vestida por modelo'],['polo-focus.png','Preto','polo isolada']],
};
async function main() {
  const db = new PrismaClient({datasources:{db:{url:'file:./dev.db'}}});
  try {
    const plan=[];
    const requestedSlug = process.argv.find(arg => arg.startsWith('--slug='))?.slice(7);
    if (requestedSlug && !mappings[requestedSlug]) throw Error(`Unknown product: ${requestedSlug}`);
    for (const [slug, entries] of Object.entries(mappings)) {
      if (requestedSlug && slug !== requestedSlug) continue;
      const product=await db.product.findUniqueOrThrow({where:{slug},include:{images:true,variants:true}});
      const images=entries.map(([file,color,angle],position)=>{
        const url=`/images/products/${file}`;
        if(!fs.existsSync(`public${url}`)) throw Error(`Missing asset: ${url}`);
        if(!product.variants.some(v=>v.color===color)) throw Error(`Unknown color: ${slug}/${color}`);
        return {url,altText:`${product.name} - ${color} - ${angle}`,position,isPrimary:position===0};
      });
      plan.push({slug,product,images,entries});
    }
    console.log(plan.map(p=>`${p.slug}: ${p.images.length} imagens revisadas`).join('\n'));
    if(!process.argv.includes('--apply')) return;
    fs.mkdirSync('.local-validation/image-audit',{recursive:true});
    const backup='.local-validation/image-audit/before-mapping.json';
    if(!fs.existsSync(backup)) fs.writeFileSync(backup,JSON.stringify(plan.map(p=>p.product),null,2));
    await db.$transaction(async tx=>{
      for(const {product,images,entries} of plan) {
        const urls=images.map(i=>i.url);
        // Only the explicitly reviewed products have their galleries reconciled.
        await tx.productImage.deleteMany({where:{productId:product.id,url:{notIn:urls}}});
        for(const data of images) {
          const existing=product.images.filter(i=>i.url===data.url);
          if(existing.length) {
            await tx.productImage.update({where:{id:existing[0].id},data});
            if(existing.length>1) await tx.productImage.deleteMany({where:{id:{in:existing.slice(1).map(i=>i.id)}}});
          } else await tx.productImage.create({data:{...data,productId:product.id}});
        }
        for(const variant of product.variants) {
          const index=entries.findIndex(e=>e[1]===variant.color);
          if(index>=0 || product.slug==='bone-focus-lab') await tx.productVariant.update({where:{id:variant.id},data:{imageUrl:index>=0 ? images[index].url : null}});
        }
      }
    });
    console.log('Mapeamento aplicado ao SQLite local.');
    for (const {slug, product, images} of plan) {
      const saved = await db.productImage.findMany({where:{productId:product.id},orderBy:{position:'asc'}});
      if (saved.length !== images.length || saved.some((image,index) => image.url !== images[index].url || image.altText !== images[index].altText || image.isPrimary !== images[index].isPrimary)) {
        throw Error(`Verification failed: ${slug}`);
      }
      console.log(`Verificado: ${slug}, ${saved.length} imagens, ordem/cor/ângulo/capa corretos.`);
    }
  } finally {await db.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
