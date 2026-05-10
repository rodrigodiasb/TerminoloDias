# Quiz Terminologias Médicas — GitHub Pages + Firebase Firestore

## Arquivos

- `index.html`: tela principal do jogo.
- `styles.css`: layout visual estilo jogo para celular.
- `app.js`: lógica do quiz, pontuação, aleatoriedade, ranking e recursos.
- `firebase-config.js`: local onde você cola a configuração do Firebase.
- `db_perguntas.json`: banco de perguntas.
- `firestore-rules.txt`: regras sugeridas para o Firestore.

## Como testar localmente

Abra a pasta no VS Code e use a extensão Live Server. Evite abrir o `index.html` diretamente com duplo clique, porque o navegador pode bloquear o carregamento do JSON.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todos os arquivos desta pasta para a raiz do repositório.
3. Vá em Settings > Pages.
4. Em Build and deployment, selecione Deploy from a branch.
5. Escolha a branch `main` e a pasta `/root`.
6. Salve e aguarde o link do GitHub Pages.

## Como conectar ao Firebase

1. Acesse Firebase Console.
2. Crie um projeto.
3. Adicione um app Web.
4. Copie o objeto `firebaseConfig`.
5. Cole no arquivo `firebase-config.js`.
6. Troque `firebaseEnabled = false` para `firebaseEnabled = true`.
7. Ative Firestore Database.
8. Ative Authentication > Sign-in method > Anonymous.
9. Cole as regras do arquivo `firestore-rules.txt` em Firestore Database > Rules.
10. Publique as regras.

## Coleções criadas automaticamente

- `resultados`: salva pontuação final, jogador, turma, acertos e perguntas usadas.
- `recursos_questoes`: salva os recursos/reportes enviados pelos jogadores.

## Aleatoriedade

Cada partida monta 10 perguntas:

- 5 fáceis
- 3 médias
- 2 difíceis

O jogo tenta não repetir perguntas já usadas no mesmo navegador. Quando o banco não tiver mais perguntas inéditas suficientes, ele libera repetição.

## Pontuação

- Fácil: 10 pontos
- Média: 20 pontos
- Difícil: 35 pontos
- Bônus: sequência de acertos aumenta a pontuação.
