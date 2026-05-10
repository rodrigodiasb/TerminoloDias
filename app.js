import { firebaseEnabled, firebaseConfig } from './firebase-config.js';

let db = null;
let auth = null;
let firebaseReady = false;

if (firebaseEnabled) {
  try {
    const appModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const authModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
    const fireModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
    const app = appModule.initializeApp(firebaseConfig);
    auth = authModule.getAuth(app);
    await authModule.signInAnonymously(auth);
    db = fireModule.getFirestore(app);
    window.__fire = fireModule;
    firebaseReady = true;
  } catch (error) {
    console.warn('Firebase não conectou. Usando modo local.', error);
  }
}

const CONFIG = {
  totalQuestions: 10,
  levelPlan: { facil: 5, medio: 3, dificil: 2 },
  points: { facil: 10, medio: 20, dificil: 35 },
  bonusPerStreak: 3,
  localKeys: {
    used: 'quiz_used_question_ids_v1',
    scores: 'quiz_local_scores_v1',
    reports: 'quiz_local_reports_v1'
  }
};

const $ = (id) => document.getElementById(id);
const screens = ['screenStart','screenGame','screenFeedback','screenResult','screenRank'];
const state = {
  allQuestions: [],
  selectedQuestions: [],
  currentIndex: 0,
  score: 0,
  correct: 0,
  streak: 0,
  playerName: '',
  playerGroup: '',
  startedAt: null,
  lastAnswerCorrect: false
};

function showScreen(id){
  screens.forEach(s => $(s).classList.toggle('active', s === id));
}

function shuffle(array){
  return [...array].sort(() => Math.random() - 0.5);
}

function normalizeLevel(level){
  const v = String(level || '').toLowerCase();
  if (v.includes('facil') || v.includes('fácil')) return 'facil';
  if (v.includes('dificil') || v.includes('difícil')) return 'dificil';
  return 'medio';
}

function getUsedIds(){
  try { return JSON.parse(localStorage.getItem(CONFIG.localKeys.used) || '[]'); }
  catch { return []; }
}

function saveUsedIds(ids){
  localStorage.setItem(CONFIG.localKeys.used, JSON.stringify([...new Set(ids)]));
}

function pickByLevel(level, amount, usedIds){
  const candidates = state.allQuestions.filter(q => normalizeLevel(q.nivel) === level);
  let fresh = shuffle(candidates.filter(q => !usedIds.includes(String(q.id))));
  let picked = fresh.slice(0, amount);
  if (picked.length < amount) {
    const complement = shuffle(candidates.filter(q => !picked.some(p => p.id === q.id))).slice(0, amount - picked.length);
    picked = [...picked, ...complement];
  }
  return picked;
}

function buildQuestionSet(){
  let usedIds = getUsedIds();
  let selected = [];
  selected.push(...pickByLevel('facil', CONFIG.levelPlan.facil, usedIds));
  selected.push(...pickByLevel('medio', CONFIG.levelPlan.medio, usedIds));
  selected.push(...pickByLevel('dificil', CONFIG.levelPlan.dificil, usedIds));

  // Organiza a curva de aprendizagem: começa mais fácil, intercala médias e fecha com desafio.
  const easy = shuffle(selected.filter(q => normalizeLevel(q.nivel) === 'facil'));
  const medium = shuffle(selected.filter(q => normalizeLevel(q.nivel) === 'medio'));
  const hard = shuffle(selected.filter(q => normalizeLevel(q.nivel) === 'dificil'));
  const ordered = [easy[0], easy[1], medium[0], easy[2], medium[1], easy[3], hard[0], easy[4], medium[2], hard[1]].filter(Boolean);

  const newUsed = [...usedIds, ...ordered.map(q => String(q.id))];
  const freshLeft = state.allQuestions.some(q => !newUsed.includes(String(q.id)));
  saveUsedIds(freshLeft ? newUsed : []);
  return ordered;
}

async function loadQuestions(){
  const response = await fetch('./db_perguntas.json');
  const data = await response.json();
  state.allQuestions = data.quiz_terminologias_medicas.questoes.map(q => ({...q, nivel: normalizeLevel(q.nivel)}));
}

function startGame(){
  const name = $('playerName').value.trim();
  const group = $('playerGroup').value.trim();
  if(!name){ alert('Informe o nome do jogador.'); return; }
  state.playerName = name;
  state.playerGroup = group || 'Sem grupo';
  state.currentIndex = 0;
  state.score = 0;
  state.correct = 0;
  state.streak = 0;
  state.startedAt = new Date();
  state.selectedQuestions = buildQuestionSet();
  $('hudPlayer').textContent = state.playerName;
  showScreen('screenGame');
  renderQuestion();
}

function renderQuestion(){
  const q = state.selectedQuestions[state.currentIndex];
  $('hudScore').textContent = state.score;
  $('hudQuestionCount').textContent = `Questão ${state.currentIndex + 1}/${state.selectedQuestions.length}`;
  $('hudLevel').textContent = q.nivel === 'facil' ? 'Fácil' : q.nivel === 'medio' ? 'Média' : 'Difícil';
  $('hudCategory').textContent = String(q.categoria || 'Geral').replaceAll('_',' ');
  $('questionText').textContent = q.pergunta;
  $('progressFill').style.width = `${((state.currentIndex) / state.selectedQuestions.length) * 100}%`;

  const answers = $('answers');
  answers.innerHTML = '';
  shuffle(q.alternativas).forEach(alt => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = alt;
    btn.addEventListener('click', () => answerQuestion(alt));
    answers.appendChild(btn);
  });
}

function answerQuestion(answer){
  const q = state.selectedQuestions[state.currentIndex];
  const isCorrect = answer === q.correta;
  state.lastAnswerCorrect = isCorrect;
  if(isCorrect){
    state.correct += 1;
    state.streak += 1;
    const base = CONFIG.points[q.nivel] || 10;
    const bonus = state.streak > 1 ? (state.streak - 1) * CONFIG.bonusPerStreak : 0;
    state.score += base + bonus;
  } else {
    state.streak = 0;
  }
  $('feedbackCard').classList.toggle('wrong', !isCorrect);
  $('feedbackIcon').textContent = isCorrect ? '✓' : '×';
  $('feedbackTitle').textContent = isCorrect ? 'Resposta certa!' : 'Resposta errada';
  $('feedbackExplanation').innerHTML = `${q.explicacao || ''}<br><br><strong>Resposta correta:</strong> ${q.correta}`;
  showScreen('screenFeedback');
}

async function nextQuestion(){
  state.currentIndex += 1;
  if(state.currentIndex >= state.selectedQuestions.length){
    await finishGame();
  } else {
    showScreen('screenGame');
    renderQuestion();
  }
}

async function finishGame(){
  $('progressFill').style.width = '100%';
  const total = state.selectedQuestions.length;
  const percent = Math.round((state.correct / total) * 100);
  $('resultSummary').textContent = `${state.playerName}, você concluiu o desafio com ${state.correct} acertos em ${total} questões.`;
  $('resultScore').textContent = state.score;
  $('resultCorrect').textContent = `${state.correct}/${total}`;
  $('resultPercent').textContent = `${percent}%`;
  await saveScore({
    playerName: state.playerName,
    playerGroup: state.playerGroup,
    score: state.score,
    correct: state.correct,
    total,
    percent,
    createdAt: new Date().toISOString(),
    questions: state.selectedQuestions.map(q => q.id)
  });
  showScreen('screenResult');
}

async function saveScore(payload){
  if(firebaseReady){
    const { addDoc, collection, serverTimestamp } = window.__fire;
    await addDoc(collection(db, 'resultados'), {...payload, createdAtServer: serverTimestamp()});
    return;
  }
  const scores = JSON.parse(localStorage.getItem(CONFIG.localKeys.scores) || '[]');
  scores.push(payload);
  localStorage.setItem(CONFIG.localKeys.scores, JSON.stringify(scores));
}

async function loadRanking(){
  let scores = [];
  if(firebaseReady){
    const { collection, getDocs, limit, orderBy, query } = window.__fire;
    const q = query(collection(db, 'resultados'), orderBy('score', 'desc'), limit(20));
    const snap = await getDocs(q);
    scores = snap.docs.map(doc => doc.data());
  } else {
    scores = JSON.parse(localStorage.getItem(CONFIG.localKeys.scores) || '[]')
      .sort((a,b) => b.score - a.score)
      .slice(0,20);
  }
  renderRanking(scores);
  showScreen('screenRank');
}

function renderRanking(scores){
  const list = $('rankList');
  list.innerHTML = '';
  if(!scores.length){
    list.innerHTML = '<p class="rank-meta">Ainda não há pontuações registradas.</p>';
    return;
  }
  scores.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'rank-item';
    row.innerHTML = `
      <div class="rank-pos">#${index + 1}</div>
      <div><div class="rank-name">${escapeHtml(item.playerName || 'Jogador')}</div><div class="rank-meta">${escapeHtml(item.playerGroup || 'Sem grupo')} • ${item.correct || 0}/${item.total || 10} acertos</div></div>
      <div class="rank-score">${item.score || 0}</div>`;
    list.appendChild(row);
  });
}

function openReport(){
  $('reportText').value = '';
  $('reportDialog').showModal();
}

async function sendReport(event){
  event.preventDefault();
  const text = $('reportText').value.trim();
  if(!text){ alert('Descreva o motivo do recurso antes de enviar.'); return; }
  const q = state.selectedQuestions[state.currentIndex];
  const payload = {
    questionId: q.id,
    questionText: q.pergunta,
    correctAnswer: q.correta,
    playerName: state.playerName,
    playerGroup: state.playerGroup,
    reportText: text,
    createdAt: new Date().toISOString()
  };
  if(firebaseReady){
    const { addDoc, collection, serverTimestamp } = window.__fire;
    await addDoc(collection(db, 'recursos_questoes'), {...payload, createdAtServer: serverTimestamp()});
  } else {
    const reports = JSON.parse(localStorage.getItem(CONFIG.localKeys.reports) || '[]');
    reports.push(payload);
    localStorage.setItem(CONFIG.localKeys.reports, JSON.stringify(reports));
  }
  $('reportDialog').close();
  alert('Recurso registrado. Obrigado por ajudar a melhorar o quiz!');
}

function escapeHtml(str){
  return String(str).replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[t]));
}

$('btnStart').addEventListener('click', startGame);
$('btnNext').addEventListener('click', nextQuestion);
$('btnRestart').addEventListener('click', () => showScreen('screenStart'));
$('btnShowRank').addEventListener('click', loadRanking);
$('btnShowRankStart').addEventListener('click', loadRanking);
$('btnBackHome').addEventListener('click', () => showScreen('screenStart'));
$('btnReport').addEventListener('click', openReport);
$('btnSendReport').addEventListener('click', sendReport);

loadQuestions().catch(err => {
  console.error(err);
  alert('Não foi possível carregar o banco de perguntas. Confira se db_perguntas.json está na mesma pasta do index.html.');
});
