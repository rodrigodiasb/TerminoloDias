// 1) Crie o projeto no Firebase.
// 2) Copie aqui a configuração gerada em: Project settings > General > Your apps > Web app.
// 3) Troque firebaseEnabled para true.

export const firebaseEnabled = true;

<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyDPaBxhYUq78_3301jQqmAC1OEfElb_brM",
    authDomain: "quiz-terminologias.firebaseapp.com",
    projectId: "quiz-terminologias",
    storageBucket: "quiz-terminologias.firebasestorage.app",
    messagingSenderId: "1014542941866",
    appId: "1:1014542941866:web:96657ac438eaf15dd85ad3",
    measurementId: "G-KVW318G6NW"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>