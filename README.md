# Quiz Terminologias Médicas — GitHub Pages + Firebase Firestore

Aplicativo web educacional em formato de jogo quiz, responsivo para celular, com perguntas aleatórias, pontuação, ranking e recurso de revisão de questão.

## Mudança da versão v3

Nesta versão, o jogador continua respondendo enquanto acertar. O desafio encerra no primeiro erro. Após errar, o jogador pode:

1. tentar novamente do zero; ou
2. finalizar e gravar a pontuação no ranking.

A progressão interna das perguntas continua usando o padrão oculto: 5 fáceis, 3 médias e 2 difíceis. Essa informação não aparece no front-end.

## Arquivos

- `index.html` — estrutura do jogo.
- `styles.css` — visual responsivo estilo game.
- `app.js` — lógica do quiz, ranking e Firebase.
- `firebase-config.js` — configuração do Firebase.
- `db_perguntas.json` — banco de perguntas.
- `firestore-rules.txt` — regras do Firestore.

## Configuração do Firebase

No arquivo `firebase-config.js`, deixe assim:

```javascript
window.QUIZ_FIREBASE_ENABLED = true;

window.QUIZ_FIREBASE_CONFIG = {
  apiKey: "SUA_CHAVE",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.firebasestorage.app",
  messagingSenderId: "SEU_NUMERO",
  appId: "SEU_APP_ID",
  measurementId: "SEU_MEASUREMENT_ID"
};
```

Não cole comandos `npm`, `import` ou tags `<script>` dentro do `firebase-config.js`.

## Firestore

No Firebase Console:

1. Entre em Firestore Database.
2. Abra Rules/Regras.
3. Cole o conteúdo de `firestore-rules.txt`.
4. Publique as regras.

A versão v3 usa regras públicas validadas. Isso permite salvar ranking e recursos sem depender obrigatoriamente do login anônimo. Se você ativar Authentication anônima, o app também reconhece, mas não é obrigatório com essas regras.

## Coleções criadas automaticamente

O app cria documentos nestas coleções:

- `resultados`
- `recursos_questoes`

Você não precisa criar as coleções manualmente. Elas aparecem após o primeiro salvamento.

## GitHub Pages

Suba todos os arquivos na raiz do repositório e ative:

Settings > Pages > Deploy from a branch > main / root

## Teste do banco online

Na tela inicial deve aparecer:

- `Banco online: conectado...` quando o Firebase estiver funcionando; ou
- uma mensagem avisando que o ranking está apenas local.

Ao finalizar o quiz, a tela de resultado informa se foi salvo no banco online ou apenas no dispositivo.
