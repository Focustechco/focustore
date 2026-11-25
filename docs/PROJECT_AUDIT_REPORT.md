# Relatório de auditoria local

## Escopo e estado inicial

Revisão da branch `banco-de-dados`, commit `2f40e6955a37bdd6906447759a8a3639283a5f65`, inicialmente limpa. O commit `7589b0a6365c30c73d9ef7d08e2714b621c9b119` não foi localizado no repositório local.

## Correção e evidências

A resposta do PUT administrativo de cliente retornava o objeto completo atualizado, inclusive o hash de senha. A consulta passou a selecionar explicitamente os campos necessários. Foi adicionado teste HTTP de regressão. Sua execução está bloqueada pela incompatibilidade entre a fixture PostgreSQL frontend e o schema Prisma SQLite.

O teste unitário frontend executou 9 testes, todos aprovados. A suíte backend com SQLite temporário executou 169 testes aprovados e registrou 9 ignorados por ausência de PostgreSQL de teste. A primeira tentativa backend teve 178 erros de setup por acesso ao diretório temporário, resolvidos com um diretório novo. TypeScript e geração Prisma concluíram.

O banco `focusstore_test` e a porta 5432 são explicitamente proibidos pelo guard de teste atual. Nenhum banco foi criado nem utilizado para testes PostgreSQL nesta revisão.

O build foi repetido com schema em SQLite descartável. Compilação, TypeScript e geração de páginas concluíram, mas o comando retornou erro de segurança indicando vulnerabilidade conhecida na versão Next.js. A atualização de segurança deve ser avaliada com lockfile e testes em uma alteração própria. A primeira tentativa usou um banco descartável sem schema e registrou falhas de consulta durante a geração de páginas.

Node 22 e o executável tsx funcionaram fora do sandbox. Dentro dele, `os.userInfo()` falhou e o tsx encontrou erro de acesso ao resolver caminho.

## Limitações

Os resultados não demonstram exclusividade comercial, paridade entre bancos, segurança completa ou prontidão para produção. A configuração de instâncias implantadas e os dados persistentes ficaram fora do escopo.

## Auditoria da CI

O workflow frontend chama o workflow backend reutilizável e o job final exige sucesso de frontend, backend e full-stack. A execução real no GitHub Actions permanece pendente. A integração frontend e o full-stack apresentaram falhas locais na revisão anterior, sem redução de assertions.
