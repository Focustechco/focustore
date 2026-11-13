const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient({datasources:{db:{url:'file:./dev.db'}}});
async function main(){
  const products=await db.product.findMany({where:{slug:{startsWith:'bone-'}},include:{variants:true}});
  for(const product of products){
    console.log(product.slug, product.variants.map(v=>({id:v.id,size:v.size})));
    if(process.argv.includes('--apply')){
      await db.productVariant.updateMany({where:{productId:product.id},data:{size:'Único'}});
      const sizes=await db.productVariant.findMany({where:{productId:product.id},select:{size:true}});
      if(sizes.some(v=>v.size!=='Único')) throw Error('Falha na verificação');
      console.log('Verificado: somente Único.');
    }
  }
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
