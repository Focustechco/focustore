const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
async function main() {
  const db = new PrismaClient({ datasources: { db: { url: 'file:./dev.db' } } });
  try {
    const products = await db.product.findMany({include:{images:{orderBy:{position:'asc'}},variants:true}});
    fs.mkdirSync('.local-validation/image-audit', {recursive:true});
    fs.writeFileSync('.local-validation/image-audit/catalog.json', JSON.stringify(products,null,2));
    console.log(products.map(p=>`${p.slug}: ${p.images.map(i=>`${i.url} (${i.altText})`).join(' | ')}\n  Cores: ${[...new Set(p.variants.map(v=>v.color))].join(', ')}`).join('\n'));
    const files = fs.readdirSync('public/images/products').filter(f=>/\.(png|jpg|webp)$/i.test(f));
    const tiles=[];
    for(const [i,f] of files.entries()) {
      const thumb=await sharp(path.join('public/images/products',f)).resize(180,150,{fit:'contain',background:'#ddd'}).flatten({background:'#ddd'}).png().toBuffer();
      const label=Buffer.from(`<svg width="180" height="38"><rect width="180" height="38" fill="white"/><text x="4" y="16" font-size="11">${i}: ${f.slice(0,23)}</text><text x="4" y="31" font-size="10">${f.slice(23,48)}</text></svg>`);
      tiles.push({input:thumb,left:(i%6)*180,top:Math.floor(i/6)*190},{input:label,left:(i%6)*180,top:Math.floor(i/6)*190+150});
    }
    await sharp({create:{width:1080,height:Math.ceil(files.length/6)*190,channels:3,background:'white'}}).composite(tiles).png().toFile('.local-validation/image-audit/contact-sheet.png');
  } finally {await db.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
