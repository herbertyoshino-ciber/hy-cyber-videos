# H.Y Risk & Intelligence
**Plataforma de conscientização e informações do meio digital**

Plataforma de vídeos sobre segurança cibernética com login e senha.
O nome e o subtítulo exibidos no app ficam em `firebase-config.js`.

- Cadastro aberto (nome, e-mail e senha) e recuperação de senha por e-mail
- Só quem está logado e não foi revogado consegue ver a lista de vídeos
- Painel do administrador: adicionar, editar e excluir vídeos; revogar ou restaurar usuários
- Vídeos hospedados no YouTube como **não listados**
- Hospedagem: GitHub Pages · Login e banco: Firebase (Authentication + Firestore)

## Configuração (uma vez só)

### 1. Criar o projeto no Firebase
1. Acesse https://console.firebase.google.com e clique em **Criar projeto** (pode desativar o Google Analytics).
2. Menu **Authentication** > **Vamos começar** > aba **Método de login** > ative **E-mail/senha**.
3. Menu **Firestore Database** > **Criar banco de dados** > escolha a região `southamerica-east1 (São Paulo)` > modo **produção**.
4. Ainda no Firestore, aba **Regras**: apague tudo, cole o conteúdo de `firestore.rules` e clique em **Publicar**.
5. Engrenagem ⚙️ > **Configurações do projeto** > em "Seus apps" clique no ícone **</>** (Web) > dê um nome > **Registrar app**. Copie o bloco `firebaseConfig`.
6. Cole esses valores em `firebase-config.js`.
7. **Authentication** > **Configurações** > **Domínios autorizados** > adicione `herbertyoshino-ciber.github.io`.

### 2. Publicar no GitHub Pages
No repositório: **Settings** > **Pages** > Source: **Deploy from a branch** > Branch: `main` / `(root)` > **Save**.
O site fica em: https://herbertyoshino-ciber.github.io/hy-cyber-videos/

### 3. Virar administrador
1. Abra o site e crie sua conta normalmente.
2. No Firebase: **Authentication** > **Usuários** > copie o **UID** da sua conta.
3. **Firestore Database** > **Iniciar coleção** > ID da coleção: `admins` > ID do documento: cole o UID > adicione um campo qualquer (ex.: `nome` = `Herbert`) > **Salvar**.
4. Recarregue o site: vai aparecer o menu **Admin**.

## Como usar

**Adicionar vídeo:** suba o vídeo no YouTube como **Não listado**, copie o link e cole no painel Admin.

**Revogar alguém:** Admin > Usuários > **Revogar**. A pessoa perde o acesso na hora.
Para bloquear o login também, vá em Firebase > Authentication > Usuários > ⋮ > **Desativar conta**.

## Limites que você deve conhecer
- Vídeo não listado não aparece em buscas, mas quem tiver o link do YouTube consegue assistir fora do app. O app esconde os links de quem não está logado, mas um membro pode copiar e repassar. Para conteúdo pago ou sensível, o ideal no futuro é um serviço de vídeo privado (Vimeo, Bunny Stream ou Cloudflare Stream).
- Quem foi revogado pode criar outra conta com outro e-mail. Se isso virar problema, dá para trocar para "cadastro + aprovação".

## Arquivos
| Arquivo | O que é |
|---|---|
| `index.html` | Página única do app |
| `app.js` | Login, cadastro, lista de vídeos, player e painel admin |
| `style.css` | Visual |
| `firebase-config.js` | Chaves do Firebase (não são secretas) e nome do app |
| `firestore.rules` | Regras de segurança do banco — é aqui que o acesso é protegido de verdade |
