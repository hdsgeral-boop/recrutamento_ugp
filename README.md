# Recrutamento - Técnico de Cadastro | Projecto UGP EPAL

Sistema de candidaturas da **CONSULVOLT** para o cadastro dos locais de consumo
de água na zona de influência da **UGP - Unidade de Gestão do Projecto da
EPAL**, em Luanda.

O trabalho é porta a porta: marcar e numerar cada local de consumo, aplicar a
etiqueta, cadastrar em tablet com georreferenciação, inquirir o morador sobre a
situação contratual da ligação e fotografar a fachada, a instalação e os
documentos. Doze bairros, projecto temporário.

Feito para correr **de graça**: Vercel Free (Hobby) + Supabase Free.

---

## O que o sistema faz

| Parte | Endereço | Descrição |
|---|---|---|
| Formulário público | `/app` | Candidatura com upload de CV, BI e Certificado |
| Confirmação | `/app/sucesso` | Ecrã "Candidatura Recebida" com referência |
| Painel de RH | `/admin` | Lista, filtros, mudança de estado, Excel, WhatsApp |
| Login do painel | `/admin/login` | Utilizador e palavra-passe das variáveis de ambiente |
| Diagnóstico | `/api/admin/diagnostico` | Testa Supabase, Drive e Gmail de uma vez |
| Arquivamento | `/api/arquivar` | Repete o envio para o Drive quando algo falha |

### Como corre uma candidatura, por dentro

```
Candidato preenche /app
   │
   ├─► 1. Browser envia os 3 PDFs directamente para o Supabase Storage  (rápido)
   ├─► 2. Server Action grava a linha na tabela `candidatos`            (< 1 s)
   ├─► 3. Candidato vê logo o ecrã "Candidatura Recebida"
   │
   └─► 4. EM SEGUNDO PLANO (waitUntil), sem o candidato esperar:
           ├─ copia os 3 ficheiros para /Recrutamento_UGP_EPAL_2026/Nome_BI/
           ├─ guarda o link da pasta na base de dados
           ├─ envia email ao candidato
           └─ envia email ao RH com a ficha + link do Drive
```

Se o passo 4 falhar (Drive em baixo, por exemplo), **nada se perde**: os
documentos ficam no Supabase Storage, a candidatura fica marcada com
`arquivamento_estado = 'erro'` e o painel mostra um aviso com o botão
*Repetir arquivamento*. Há também um Cron diário que apanha os pendentes.

---

## 1. Supabase (base de dados e ficheiros)

1. Cria um projecto novo em <https://supabase.com> - região **West EU (Ireland)**
   é a mais próxima de Angola com plano gratuito.
2. Abre **SQL Editor → New query**, cola o conteúdo de `supabase/schema.sql`
   e carrega em **Run**. Isto cria:
   - os tipos `status_candidatura` e `provincia_angola`;
   - a tabela `candidatos` com as validações e os índices;
   - as políticas de RLS (público insere, autenticados leem);
   - o bucket privado `documentos-candidatos` (700 KB por ficheiro, só PDF/JPG/PNG).
3. Vai a **Project Settings → API** e copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **nunca no browser**

> Se o teu projecto Supabase já tinha um bucket com este nome, o `insert ... on
> conflict do update` do schema só ajusta os limites - não apaga nada.

---

## 2. Google Cloud (Drive API + Service Account)

1. <https://console.cloud.google.com> → **Novo projecto**, ex.: `consulvolt-recrutamento`.
2. **APIs e serviços → Biblioteca** → procura **Google Drive API** → **Activar**.
3. **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**
   - Nome: `recrutamento-bengo`
   - Não é preciso atribuir papéis do IAM.
4. Abre a conta de serviço criada → separador **Chaves** → **Adicionar chave →
   Criar nova chave → JSON**. Descarrega o ficheiro.
5. Abre o JSON, copia **tudo** e cola em `GOOGLE_SERVICE_ACCOUNT_JSON`.
   - Em `.env.local`, envolve em plicas simples e deixa numa só linha:
     `GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ...}'`
   - Na Vercel, cola o JSON tal e qual no campo do valor.
6. No **Google Drive**, cria a pasta onde vão ficar os processos (ex.:
   `Recrutamento CONSULVOLT`).
7. **Partilha** essa pasta com o email da conta de serviço
   (`recrutamento-bengo@...gserviceaccount.com`), com permissão de **Editor**.
8. Abre a pasta e copia o ID do endereço:
   `https://drive.google.com/drive/folders/`**`1AbCdEfGh...`** → `GOOGLE_DRIVE_FOLDER_ID`.

> **Contas de serviço não têm quota de armazenamento própria.** Por isso a pasta
> tem de pertencer a uma conta Google normal (ou a uma Shared Drive) e ser
> partilhada com a conta de serviço - é a conta dona que "paga" o espaço.
> Se usares uma **Shared Drive**, põe `GOOGLE_DRIVE_SHARED_DRIVE=true`.

---

## 3. Gmail (envio de emails)

Optámos por **SMTP com palavra-passe de aplicação** em vez de OAuth2: não exige
ecrã de consentimento nem renovação de tokens, e cabe folgadamente no limite de
tempo das funções da Vercel.

1. Na conta que vai enviar (ex.: `hdsgeral@gmail.com`), activa a
   **verificação em 2 passos**: <https://myaccount.google.com/security>
2. Vai a <https://myaccount.google.com/apppasswords>, cria uma palavra-passe de
   aplicação chamada `Recrutamento UGP` e copia os 16 caracteres.
3. Preenche:
   - `GMAIL_USER` → a conta Gmail que envia
   - `GMAIL_APP_PASSWORD` → os 16 caracteres (com ou sem espaços)
   - `RH_EMAIL` → `recrutamento@consulvolt.pt` (aceita várias, separadas por vírgula)

> O SMTP do domínio `consulvolt.pt` (mailbox.pt) não autentica - por isso o envio
> sai pelo Gmail. Os emails chegam a `recrutamento@consulvolt.pt` na mesma.
> Limite do Gmail gratuito: ~500 emails/dia. Mais do que suficiente aqui.

---

## 4. Correr localmente

```bash
npm install
cp .env.example .env.local     # e preenche os valores
npm run dev                    # http://localhost:3000/app
```

Verificações úteis:

```bash
npm run typecheck              # TypeScript sem erros
npm run build                  # build de produção
```

---

## 5. Deploy na Vercel

1. Põe o código num repositório Git (GitHub, GitLab ou Bitbucket).
2. <https://vercel.com> → **Add New → Project** → importa o repositório.
   O framework é detectado automaticamente (Next.js).
3. Em **Environment Variables**, adiciona **todas** as variáveis do
   `.env.example`, para os ambientes *Production*, *Preview* e *Development*.
4. **Deploy**.
5. Depois do primeiro deploy, volta às variáveis e corrige
   `NEXT_PUBLIC_SITE_URL` com o endereço real (ex.:
   `https://recrutamento-bengo.vercel.app`) e faz **Redeploy**.
6. Abre `https://<o-teu-site>/api/admin/diagnostico` (depois de entrares no
   painel) e confirma que dá `"tudoBem": true`.

### Notas do plano gratuito

- **Região:** o `vercel.json` fixa `fra1` (Frankfurt), a mais próxima de Angola.
- **Duração das funções:** o Hobby permite até 60 s. O caminho crítico da
  candidatura fica bem abaixo de 1 s porque o Drive corre em segundo plano.
- **Cron:** o Hobby só permite tarefas **uma vez por dia**. O `vercel.json`
  agenda `/api/arquivar` para as 06:00 UTC (07:00 em Luanda). A Vercel envia
  sozinha o cabeçalho `Authorization: Bearer $CRON_SECRET`.
- **Corpo dos pedidos:** limitado a 4,5 MB - por isso os ficheiros **não passam
  pelo servidor**; vão do browser directamente para o Supabase Storage.

---

## 6. Painel de RH

Entra em `/admin`. Enquanto a tabela `utilizadores_painel` estiver vazia, valem
o `ADMIN_USER` e o `ADMIN_PASS` do ambiente; a partir da primeira conta criada
no painel, são as contas da tabela que mandam. A sessão dura 12 horas
e é guardada num cookie assinado com HMAC-SHA256 (`ADMIN_SESSION_SECRET`),
validado pelo `middleware.ts` a cada pedido.

O que se pode fazer:

- **Filtrar** por bairro, município, estado, data de submissão, carta de
  condução, ferramentas digitais e atendimento ao público; procurar por nome,
  BI, email ou telefone. Os filtros ficam no endereço, por isso podes partilhar
  um link já filtrado.
- **Ver detalhes** de cada candidato (`/admin/candidato/<id>`), com ficha
  completa, notas internas e impressão em Ctrl+P.
- **Baixar todos os documentos** - gera links temporários de 1 hora para os
  ficheiros no Storage.
- **Mudar estado**: Pendente → Aprovado / Reprovado / Contactado, com
  observações internas que o candidato nunca vê.
- **Exportar para Excel** - `.xlsx` com duas folhas (Candidaturas + Resumo),
  respeitando os filtros activos, com links clicáveis para as pastas do Drive.
- **Enviar WhatsApp** - abre `wa.me/2449XXXXXXXX` com a mensagem já escrita.
  Há quatro modelos: confirmar recepção, convocar para entrevista, pedir
  documento em falta e comunicar não selecção.

---

## 7. Estrutura do projecto

```
recrutamento-bengo/
├── .env.example                  # Todas as variáveis necessárias
├── vercel.json                   # Região fra1 + cron diário de arquivamento
├── public/
│   ├── logo-consulvolt.png       # Logótipo com fundo transparente
│   ├── icon.png                  # Favicon
│   └── apple-icon.png
├── supabase/
│   ├── schema.sql                # Tabela, tipos, RLS, bucket, vista de resumo
│   └── migracao-provincias.sql   # Migração do schema inicial para o das províncias
└── src/
    ├── middleware.ts             # Protege /admin e /api/admin (TEM de viver em src/)
    ├── app/
    │   ├── layout.tsx            # Layout raiz + notificações (sonner)
    │   ├── page.tsx              # Raiz → redirecciona para /app
    │   ├── not-found.tsx
    │   ├── app/
    │   │   ├── page.tsx          # Formulário público
    │   │   ├── accoes.ts         # Server Actions: submeter, verificar duplicado
    │   │   └── sucesso/page.tsx  # "Candidatura Recebida"
    │   ├── admin/
    │   │   ├── layout.tsx        # Cabeçalho do painel + botão Sair
    │   │   ├── page.tsx          # Lista, filtros, indicadores
    │   │   ├── accoes.ts         # Mudar estado, links de documentos, reprocessar
    │   │   ├── accoes-login.ts   # Entrar / sair
    │   │   ├── login/page.tsx
    │   │   └── candidato/[id]/page.tsx
    │   └── api/
    │       ├── arquivar/route.ts             # Drive + emails (POST e cron GET)
    │       └── admin/
    │           ├── exportar/route.ts         # Excel .xlsx
    │           └── diagnostico/route.ts      # Teste das 3 integrações
    ├── components/
    │   ├── ui/                   # shadcn/ui: button, input, select, table, dialog…
    │   ├── formulario-candidatura.tsx
    │   ├── campo-ficheiro.tsx
    │   ├── formulario-login.tsx
    │   ├── tabela-candidatos.tsx
    │   ├── filtros-candidatos.tsx
    │   ├── accoes-candidato.tsx
    │   ├── cartoes-resumo.tsx
    │   └── cabecalho-publico.tsx
    ├── lib/
    │   ├── supabase/cliente.ts   # Browser (anon)
    │   ├── supabase/servidor.ts  # Servidor (service_role)
    │   ├── google-drive.ts       # Service Account + criação de pastas
    │   ├── email.ts              # Nodemailer + moldes HTML
    │   ├── arquivamento.ts       # Tarefa de fundo: Drive + 2 emails
    │   ├── auth.ts               # Sessão do painel (HMAC, Web Crypto)
    │   ├── validacoes.ts         # Esquemas zod + normalização de telefone
    │   ├── whatsapp.ts           # Modelos de mensagem + link wa.me
    │   ├── constantes.ts         # Municípios, níveis, estados, dados da empresa
    │   └── utils.ts
    └── types/database.ts
```

---

## 7b. Zona de trabalho: província, município e bairro

O recrutamento é só para a **UGP**, em Luanda. O formulário pede província,
município e **bairro**, e é o bairro que interessa de verdade.

Os doze bairros do projecto estão em `BAIRROS_UGP`, em `src/lib/constantes.ts`:
Cabolombo, Casas Brancas, Cawelele, Corimba, Costa do Sol, Futungo de Belas,
Gamek, Imbondeiro, Inorade, Morro Bento I, Morro Bento II e Morro da Luz. Quem
mora fora escolhe "Outro bairro de Luanda" e candidata-se na mesma - perde
pontos na residência, não é excluído.

**Porque é que o bairro vale tanto.** O piloto visitou 14.541 portas e só
conseguiu 8.399 inquéritos. Dos 6.141 insucessos, 74,7% foram casa fechada, e a
taxa de sucesso variou entre 83,6% no Inorade e 43,2% no Morro Bento II. O que
separa um bom técnico de um mau não é a força nem o conhecimento técnico: é
conseguir que a porta abra. Quem é conhecido no bairro consegue, e chega ao
terreno sem duas horas de transporte.

Para mudar a lista de bairros: edita a constante **e** o CHECK no
`supabase/schema-ugp.sql`, e corre um `alter table ... drop constraint / add
constraint` no Supabase. O bairro é `text` (e não um ENUM) precisamente para
esta lista poder mudar sem as dores de um `ALTER TYPE`.

## 7b-bis. Google Drive: o âmbito drive.file e a pasta-mãe

O sistema autentica-se de duas maneiras e escolhe sozinho: se encontrar
`GOOGLE_OAUTH_CLIENT_ID`, `..._SECRET` e `..._REFRESH_TOKEN`, escreve **em nome
do utilizador** que autorizou; se só encontrar `GOOGLE_SERVICE_ACCOUNT_JSON`,
usa a conta de serviço (que **só funciona em Drives Partilhadas**, porque as
contas de serviço não têm quota e não podem ser donas de ficheiros).

Com o âmbito `drive.file`, a aplicação **só vê os ficheiros que ela própria
criou**. Uma pasta feita à mão no Drive é invisível para ela e devolve
`File not found`. Por isso o `GOOGLE_DRIVE_FOLDER_ID` é **opcional**: se estiver
vazio ou inacessível, a pasta `Recrutamento_UGP_EPAL_2026` é criada na raiz do
disco do utilizador, que continua a ser o dono de tudo. Só faz sentido
preencher esse ID quando se usa uma Drive Partilhada.

## 7c. Prazo, atribuições e condições de trabalho

- **O prazo muda-se no painel**, em `/admin/definicoes`, sem novo deploy. Fica
  numa linha única da tabela `definicoes`, lida por `src/lib/definicoes.ts`. O
  valor em `PRAZO_CANDIDATURA` (`src/lib/constantes.ts`) passou a ser só o
  ponto de partida: serve enquanto a linha não existir ou enquanto a base não
  responder, para o formulário nunca ficar em branco por causa de uma leitura
  falhada.
- Na mesma página definem-se as **vagas previstas** (8 a 12 técnicos, número que
  **nunca aparece** no formulário nem em email nenhum) e um interruptor para
  fechar as candidaturas antes do prazo.
- Fechar não é só esconder o formulário: `submeterCandidatura` volta a verificar
  o prazo no servidor, senão quem tivesse a página aberta desde antes do fecho
  continuava a conseguir submeter.
- As atribuições da função (`ATRIBUICOES`) aparecem no topo do formulário e as
  condições de trabalho (`CONDICOES_TRABALHO`) no fim, antes da caixa de
  confirmação obrigatória, que fica gravada em `condicoes_aceites`.
- **Limite de 700 KB por ficheiro.** Como uma foto de telemóvel anda pelos 2-5 MB,
  o `src/lib/comprimir-imagem.ts` reduz JPG e PNG no próprio browser até caberem,
  antes de qualquer envio. PDFs não se comprimem no browser: esses têm de vir já
  dentro do limite. O bucket do Supabase também rejeita acima de 700 KB, por isso
  o limite é real e não apenas cosmético.

## 7d. Ranking: como os documentos são lidos

A leitura de cada candidatura tem três camadas, e as duas primeiras não
custam nada nem precisam de chave nenhuma:

| Camada | O que faz | Precisa de quê |
|---|---|---|
| 1. OCR do Google Drive | Tira o texto de PDFs e fotografias de certificados | As credenciais do Drive que já estão configuradas |
| 2. Extractor determinístico | Encontra factos por dicionário e expressões regulares, em TypeScript puro | Nada |
| 3. Modelo de linguagem | Interpreta o texto do OCR e devolve factos estruturados | `GEMINI_API_KEY` (ou `ANTHROPIC_API_KEY`) |

As camadas 2 e 3 fundem-se em `src/lib/analise/fusao.ts`: o modelo ganha onde
encontrou alguma coisa, a heurística preenche o que ele deixou vazio. Nunca se
perde um facto na fusão, só se acrescenta.

**Sem a camada 3**, só pontuam os critérios que vêm do formulário e os que o
dicionário apanha. Com ela sobe bastante, porque o modelo lê percursos
profissionais escritos em prosa, que nenhum dicionário apanha.

A chave do Gemini tira-se em <https://aistudio.google.com/apikey>. **O plano
Google AI Ultra não paga esta API** - a chave tem um plano gratuito próprio,
que chega para algumas centenas de candidaturas.

### Refazer as análises quando o motor melhora

`VERSAO_MOTOR`, em `src/lib/analise/versao.ts`, entra no `hash_documentos` de
cada análise. Ao mudar essa constante, todas as análises anteriores passam a
contar como desactualizadas: o `/admin/ranking` mostra um aviso e o botão
*Analisar* refá-las, três de cada vez, com uma barra de progresso.

**Nada se apaga.** As análises antigas ficam em `analises_candidato` e é o
histórico que permite explicar, meses depois, porque é que um candidato tinha
38 pontos e passou a ter 76. O painel mostra sempre a mais recente que esteja
concluída - uma tentativa falhada nunca esconde uma pontuação boa.

Há também `POST /api/admin/analises/lote?quantos=3`, protegido pelo mesmo
middleware, que faz o mesmo por HTTP e devolve quantas faltam.

### O que as cores querem dizer

A legenda está na própria página, em `/admin/ranking`, e o texto vive todo em
`src/lib/ranking/apresentacao.ts`. Passar o rato por cima da pontuação, das
barras ou do crachá de alertas mostra o resumo daquele candidato em concreto.

Escalões: 75+ muito forte, 60+ forte, 45+ médio, abaixo disso fraco. São
escalões de leitura, não decisões - a aprovação continua a ser um acto
explícito de uma pessoa na ficha do candidato.

### A rubrica ugp-v1, critério a critério

| Código | Critério | Pontos |
|---|---|---|
| A | Residência na zona de trabalho | 20 |
| B | Cadastro, censo, inquérito ou recolha de dados no terreno | 24 |
| C | Literacia digital: tablet, GPS e formulários | 20 |
| D | Atendimento ao público e comunicação | 17 |
| E | Escolaridade e formação | 10 |
| F | Carta de condução e deslocação | 5 |
| G | Fotografia e registo de imagem | 2 |
| H | Completude da candidatura | 2 |

Total: **100 pontos**. O único critério eliminatório é a 12.ª classe, e mesmo
esse não elimina quando o formulário a declara e o certificado não foi lido pelo
OCR - nesse caso fica uma nota para confirmar na entrevista.

O ficheiro `src/lib/ranking/rubrica-ugp-v1.ts` é uma **função pura**: não chama
rede nem base de dados, e o mesmo candidato com os mesmos documentos dá sempre o
mesmo número. Mudar um peso não obriga a reprocessar documento nenhum. Cada
banda de cada critério tem um teste com o número escrito à mão em
`src/lib/ranking/__tests__/rubrica.test.mts`.

## 7e. Paginação

Todas as listas longas do painel (candidaturas, ranking e histórico de emails)
mostram 10 linhas por página, e o utilizador pode escolher 25, 50 ou 100. A
escolha vive no endereço (`?pagina=2&porPagina=25`), por isso sobrevive ao
recarregar e pode ser partilhada por link. Mudar de filtro volta sempre à
primeira página.

A lógica está em `src/lib/paginacao.ts` e tem testes em
`src/lib/__tests__/paginacao.test.mts`.

### Testes

```bash
npm test
```

72 testes sobre a rubrica, o extractor determinístico, a fusão, a paginação,
as permissões, as datas e as palavras-passe geradas.
Correm em segundos e não tocam na rede nem na base de dados.

## 7f. Contas do painel e permissões

Quatro papéis. A tabela vive em `src/lib/permissoes.ts` e é de lá que sai toda
a decisão - não há verificações espalhadas pelo código.

| | Ver | Exportar | Editar candidatura | Analisar | Enviar email | Marcar fases | Gerir contas |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Administrador** | sim | sim | sim | sim | sim | sim | sim |
| **Gestor** | sim | sim | sim | sim | sim | sim | - |
| **Editor** | sim | sim | sim | sim | - | - | - |
| **Visualizador** | sim | - | - | - | - | - | - |

A interface esconde os botões que o papel não permite, mas **isso não é
segurança**: cada Server Action volta a confirmar a permissão, e as rotas
`/api/admin/exportar` e `/api/admin/analises/lote` também.

As palavras-passe são guardadas com PBKDF2-SHA256, 120 mil iterações, sal
próprio por conta. Nem com a tabela toda na mão se recuperam.

O nome e o papel viajam dentro do cookie de sessão, assinado com HMAC, para o
middleware poder decidir no Edge sem consultar a base de dados a cada pedido.
Um cookie adulterado a dizer `admin` é recusado - há um teste que o prova. Em
troca, mudar o papel de alguém só faz efeito quando essa pessoa voltar a
entrar, no máximo 12 horas depois; para que mude já, desactiva-se e
reactiva-se a conta.

O par `ADMIN_USER`/`ADMIN_PASS` das variáveis de ambiente continua a funcionar
como **acesso de recurso**: se alguém desactivar por engano o último
administrador, ainda há maneira de entrar. Não aparece na lista de contas
porque não é uma conta.

## 7g. Marcação em massa e fases

Quatro fases: **Entrevista**, **Formação**, **Teste de Fluxo** e **Reunião**.
Cada uma tem o seu email, a sua cor e as suas indicações de omissão, em
`src/lib/constantes-fases.ts`.

Em `/admin/comunicacoes` escolhe-se um conjunto de candidatos (com procura e
filtro por estado), a fase, a data, o local e as indicações, e marca-se tudo
de uma vez. O envio dos emails é opcional e separado da marcação: pode-se
marcar hoje e avisar amanhã, quando a data estiver confirmada.

Os lotes são de cinco e o ciclo corre no browser, com barra de progresso. Se a
página fechar a meio, o que já foi marcado fica marcado.

As marcações ficam em `eventos_candidato` e aparecem na ficha de cada
candidato. A entrevista continua também a preencher as colunas antigas de
`candidatos`, para as vistas anteriores não passarem a mentir.

## 7h. Datas: sempre na hora de Angola

O servidor da Vercel corre em UTC. Um `toLocaleString` sem fuso mostrava menos
uma hora do que a hora real de Luanda - e um email a dizer que a entrevista é
às 08h30, quando é às 09h30, faz alguém perder a vaga.

Toda a formatação de datas passa por `src/lib/datas.ts`, fixada em
`Africa/Luanda` (UTC+1 o ano inteiro, sem hora de Verão). O que se escreve num
campo de data e hora é lido como hora de Angola, esteja quem marca onde
estiver. Há testes que correm com `TZ=UTC` de propósito, para o defeito não
voltar.

**Regra:** nenhuma data mostrada ao utilizador é formatada fora deste ficheiro.

## 7i. Responsividade

Abaixo de 1024px o menu passa a hambúrguer, com o nome de quem está ligado e o
papel lá dentro. A lista de candidaturas vira cartões no telemóvel - uma
tabela de seis colunas num ecrã de 360px obriga a arrastar para o lado só para
ler o nome da pessoa.

Verificado com Chromium a 360, 390, 768, 1024 e 1440px: zero transbordo
horizontal nas seis páginas.

## 7j. Contas: a palavra-passe nunca passa pelo administrador

Quem cria a conta escolhe o nome, o email e o papel. **Não escolhe a
palavra-passe nem a chega a ver.** O sistema gera uma, cifra-a, e manda-a por
email à pessoa. É o que impede um administrador de entrar na conta de outra
pessoa e agir em nome dela.

O ciclo:

1. **Criar** - email obrigatório, porque é por lá que a palavra-passe chega.
   Sai um email de boas-vindas com o utilizador, a palavra-passe e o link.
2. **Primeiro acesso** - o painel inteiro está fechado até a pessoa escolher
   uma palavra-passe sua. O middleware trava tudo, incluindo as rotas de API:
   uma conta por estrear não exporta o Excel com os dados de ninguém.
3. **Repor** - o administrador pede uma palavra-passe nova; ela é gerada,
   enviada por email, e a conta volta a ficar obrigada a trocar. O
   administrador fica a saber para onde foi, não o que foi.
4. **Trocar** - em `/admin/perfil` ou no ecrã de passagem obrigatória. Exige
   sempre a palavra-passe actual: um cookie roubado não pode bastar.

A palavra-passe gerada tem 14 caracteres e não usa `l`, `I`, `1`, `O` nem `0`:
estas credenciais são lidas ao telefone, e um `l` confundido com um `1` gasta
uma chamada de cada vez.

## 7k. Os meus dados

`/admin/perfil` deixa cada pessoa mudar o nome, o telefone e a palavra-passe.
**O email não.** Não é esquecimento: é por ele que as palavras-passe chegam, e
deixar cada um mudá-lo sozinho seria uma forma de desviar a conta de outra
pessoa. Muda-se pedindo a um administrador.

## 7l. Filtro por datas

Em `/admin`, dentro dos filtros, há um intervalo de datas de submissão com
atalhos para hoje, ontem, últimos 7 e últimos 30 dias. Os limites são
interpretados em hora de Angola: escolher 1 a 10 de Setembro traz as
candidaturas feitas entre as 23h e a meia-noite do dia 10, que em UTC já
pertenceriam ao dia seguinte.

## 7m. Definições do recrutamento

`/admin/definicoes`, visível a quem tenha a capacidade `configurar` (admin e
gestor). Três coisas, todas com efeito imediato e sem novo deploy:

| Definição | Onde se vê |
|---|---|
| Prazo das candidaturas | Contador do cabeçalho público, cartão do ranking, fecho do formulário |
| Vagas previstas | Só no painel. **Nunca** no formulário nem em email |
| Formulário aberto/fechado | Substitui o formulário por um aviso, com texto configurável |

A rota está barrada no `middleware.ts` a quem não tem a capacidade, e a Server
Action `guardarDefinicoes` volta a confirmar - esconder um botão não é
segurança.

## 8. Segurança

- **RLS ligado** na tabela: o público só insere; ler exige autenticação.
  O painel usa a `service_role` **apenas no servidor**.
- **Bucket privado**: os documentos só se acedem por URLs assinados de 1 hora,
  gerados no painel.
- **Validação em três camadas**: no browser (zod + tipo/tamanho do ficheiro),
  na Server Action (zod outra vez, nunca confiar no cliente) e na base de dados
  (`UNIQUE`, `CHECK`, tipos ENUM).
- **BI e email únicos**, com normalização automática (BI em maiúsculas, email em
  minúsculas) por trigger - evita duplicados por diferença de caixa.
- **Login com travão**: 5 tentativas falhadas bloqueiam 10 minutos.
- **Comparações em tempo constante** nas credenciais e no `CRON_SECRET`.
- Cookie `httpOnly`, `sameSite=lax` e `secure` em produção.

---

## 9. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `File not found` ao criar pasta no Drive | A pasta-mãe não foi partilhada com a conta de serviço | Partilha como **Editor** e confirma o `GOOGLE_DRIVE_FOLDER_ID` |
| `Service Accounts do not have storage quota` | A pasta-mãe pertence à própria conta de serviço | Cria a pasta numa conta Google normal e partilha-a |
| `Invalid login: 535` no email | Palavra-passe normal em vez de palavra-passe de aplicação | Gera uma em `myaccount.google.com/apppasswords` |
| `GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido` | JSON partido em várias linhas no `.env.local` | Põe tudo numa linha, entre plicas simples |
| Upload falha com `new row violates row-level security` | O schema não foi corrido por inteiro | Volta a correr `supabase/schema.sql` |
| Painel dá erro a ler candidaturas | `SUPABASE_SERVICE_ROLE_KEY` em falta ou errada | Copia outra vez de *Project Settings → API* |
| Candidatura entra mas não chega ao Drive | Falha temporária do Drive | Painel → detalhes → **Repetir arquivamento** |

Para um retrato completo, abre `/api/admin/diagnostico` já com sessão iniciada.

---

## 10. Depois dos 3 meses

O projecto é temporário. Para encerrar sem perder nada:

1. Exporta o Excel completo (sem filtros) a partir do painel.
2. Confirma que todas as candidaturas têm `arquivamento_estado = 'concluido'` -
   as pastas ficam no Google Drive, que é o arquivo definitivo.
3. Podes então pausar o projecto Supabase e o projecto na Vercel.

---

**CONSULVOLT - Comércio e Prestação de Serviços, Lda.**
Urbanização Lar do Patriota, Rua 6/8 - Luanda, Angola · <https://www.consulvolt.pt>
