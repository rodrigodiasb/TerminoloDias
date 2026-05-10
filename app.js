let db = null;
let firebaseReady = false;
let firebaseAuthReady = false;
let fire = null;

const firebaseConfig = window.QUIZ_FIREBASE_CONFIG || {};
const firebaseEnabled = Boolean(window.QUIZ_FIREBASE_ENABLED);

const CONFIG = {
  levelPlan: { facil: 5, medio: 3, dificil: 2 },
  learningPattern: ['facil','facil','facil','facil','facil','medio','medio','medio','dificil','dificil'],
  points: { facil: 10, medio: 20, dificil: 35 },
  bonusPerStreak: 3,
  modes: {
    dificil: { label: 'difícil', file: 'db_perguntas.json', className: 'dificil' },
    facil: { label: 'fácil', file: 'db_perguntas2.json', className: 'facil' }
  },
  localKeys: {
    used: 'quiz_used_question_ids_v6',
    scores: 'quiz_local_scores_v6',
    reports: 'quiz_local_reports_v6'
  }
};

const $ = (id) => document.getElementById(id);
const screens = ['screenStart','screenGame','screenFeedback','screenResult','screenRank'];

const state = {
  allQuestions: [],
  currentQuestion: null,
  sessionQuestionIds: [],
  patternIndex: 0,
  score: 0,
  correct: 0,
  answered: 0,
  mistakes: 0,
  streak: 0,
  playerName: '',
  playerGroup: '',
  startedAt: null,
  endedAt: null,
  questionsLoaded: false,
  currentQuestionBank: '',
  quizMode: 'dificil',
  lastAnswerCorrect: false,
  gameLockedByError: false,
  lastSaveMode: ''
};

function getSelectedQuizMode(){
  const checked = document.querySelector('input[name="quizMode"]:checked');
  const mode = checked?.value || 'dificil';
  return CONFIG.modes[mode] ? mode : 'dificil';
}

function getModeConfig(mode = getSelectedQuizMode()){
  return CONFIG.modes[mode] || CONFIG.modes.dificil;
}

function updateModeVisualState(){
  const selected = getSelectedQuizMode();
  document.querySelectorAll('.mode-option').forEach(label => {
    const input = label.querySelector('input[name="quizMode"]');
    label.classList.toggle('selected', input?.value === selected);
  });
}

function modeBadgeHtml(item){
  const raw = item?.quizMode || item?.mode || 'dificil';
  const mode = CONFIG.modes[raw] ? raw : 'dificil';
  const cfg = getModeConfig(mode);
  return `<span class="mode-badge ${cfg.className}">(${cfg.label})</span>`;
}

function setStatus(message, type = ''){
  const el = $('statusMessage');
  if (!el) return;
  el.textContent = message || '';
  el.classList.remove('ok','warn','error');
  if(type) el.classList.add(type);
}

function setDbStatus(message, type = ''){
  const el = $('dbStatus');
  if (!el) return;
  el.textContent = message || '';
  el.classList.remove('ok','warn','error');
  if(type) el.classList.add(type);
}

function setSaveStatus(message, type = ''){
  const el = $('saveStatus');
  if (!el) return;
  el.textContent = message || '';
  el.classList.remove('ok','warn','error');
  if(type) el.classList.add(type);
}

function showScreen(id){
  screens.forEach(s => $(s)?.classList.toggle('active', s === id));
}

function shuffle(array){
  const copy = [...array];
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeLevel(level){
  const v = String(level || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (v.includes('facil')) return 'facil';
  if (v.includes('dificil')) return 'dificil';
  return 'medio';
}

function getUsedIds(){
  try { return JSON.parse(localStorage.getItem(CONFIG.localKeys.used) || '[]'); }
  catch { return []; }
}

function saveUsedIds(ids){
  localStorage.setItem(CONFIG.localKeys.used, JSON.stringify([...new Set(ids.map(String))]));
}

function markQuestionAsUsed(questionId){
  if(questionId === undefined || questionId === null) return;
  const used = getUsedIds();
  used.push(String(questionId));
  const allIds = new Set(state.allQuestions.map(q => String(q.id)));
  const unique = [...new Set(used.map(String))];
  const stillHasFreshQuestions = [...allIds].some(id => !unique.includes(id));
  saveUsedIds(stillHasFreshQuestions ? unique : []);
}

function getCandidatePool(level){
  const used = new Set(getUsedIds().map(String));
  const session = new Set(state.sessionQuestionIds.map(String));
  const byLevel = state.allQuestions.filter(q => normalizeLevel(q.nivel) === level);

  let pool = byLevel.filter(q => !used.has(String(q.id)) && !session.has(String(q.id)));
  if(pool.length) return shuffle(pool);

  pool = byLevel.filter(q => !session.has(String(q.id)));
  if(pool.length) return shuffle(pool);

  pool = state.allQuestions.filter(q => !used.has(String(q.id)) && !session.has(String(q.id)));
  if(pool.length) return shuffle(pool);

  pool = state.allQuestions.filter(q => !session.has(String(q.id)));
  if(pool.length) return shuffle(pool);

  saveUsedIds([]);
  state.sessionQuestionIds = [];
  return shuffle(state.allQuestions);
}

function pickNextQuestion(){
  if(!state.allQuestions.length) return null;

  for(let attempt = 0; attempt < CONFIG.learningPattern.length; attempt++){
    const level = CONFIG.learningPattern[(state.patternIndex + attempt) % CONFIG.learningPattern.length];
    const pool = getCandidatePool(level);
    if(pool.length){
      state.patternIndex = (state.patternIndex + attempt + 1) % CONFIG.learningPattern.length;
      const selected = pool[0];
      state.sessionQuestionIds.push(String(selected.id));
      markQuestionAsUsed(selected.id);
      return selected;
    }
  }

  const fallback = shuffle(state.allQuestions)[0] || null;
  if(fallback){
    state.patternIndex = (state.patternIndex + 1) % CONFIG.learningPattern.length;
    state.sessionQuestionIds.push(String(fallback.id));
    markQuestionAsUsed(fallback.id);
  }
  return fallback;
}

async function loadQuestions(mode = getSelectedQuizMode(), force = false){
  const cfg = getModeConfig(mode);

  if(!force && state.questionsLoaded && state.currentQuestionBank === cfg.file){
    return;
  }

  try {
    state.questionsLoaded = false;
    state.allQuestions = [];
    state.currentQuestionBank = cfg.file;
    state.quizMode = mode;

    const response = await fetch(`./${cfg.file}`, { cache: 'no-store' });
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const questions = data?.quiz_terminologias_medicas?.questoes || data?.questoes || [];
    if(!Array.isArray(questions) || !questions.length) {
      throw new Error('Nenhuma questão encontrada no JSON.');
    }
    state.allQuestions = questions.map(q => ({...q, nivel: normalizeLevel(q.nivel)}));
    state.questionsLoaded = true;
    setStatus(`Banco carregado: ${state.allQuestions.length} questões disponíveis.`, 'ok');
  } catch (err) {
    console.error('Erro ao carregar perguntas:', err);
    state.questionsLoaded = false;
    setStatus(`Erro ao carregar ${cfg.file}. Confira se o arquivo está na mesma pasta do index.html.`, 'warn');
  }
}

async function initFirebase(){
  if(!firebaseEnabled){
    console.info('Firebase desativado. Usando modo local.');
    setDbStatus('Banco online: desativado neste arquivo. Ranking ficará apenas neste dispositivo.', 'warn');
    return;
  }

  if(!firebaseConfig || !firebaseConfig.projectId || String(firebaseConfig.projectId).includes('COLE_AQUI')){
    console.warn('Firebase ativado, mas firebaseConfig está incompleto. Usando modo local.');
    setDbStatus('Banco online: configuração incompleta. Confira o firebase-config.js.', 'error');
    return;
  }

  try {
    setDbStatus('Banco online: conectando...', 'warn');
    const appModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const fireModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
    const app = appModule.initializeApp(firebaseConfig);
    db = fireModule.getFirestore(app);
    fire = fireModule;
    firebaseReady = true;

    try {
      const authModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
      const auth = authModule.getAuth(app);
      await authModule.signInAnonymously(auth);
      firebaseAuthReady = true;
      setDbStatus('Banco online: conectado com login anônimo.', 'ok');
    } catch (authError) {
      firebaseAuthReady = false;
      console.warn('Login anônimo não ativado. O jogo tentará usar regras públicas validadas.', authError);
      setDbStatus('Banco online: conectado. Login anônimo não ativado; use as regras públicas validadas.', 'warn');
    }
  } catch (error) {
    console.warn('Firebase não conectou. O jogo continuará em modo local.', error);
    firebaseReady = false;
    setDbStatus('Banco online: não conectado. Abra o console do navegador para ver o erro.', 'error');
  }
}

async function startGame(){
  const name = $('playerName').value.trim();
  const group = $('playerGroup').value.trim();
  const selectedMode = getSelectedQuizMode();
  const selectedModeConfig = getModeConfig(selectedMode);

  if(!name){ alert('Informe o nome do militar.'); return; }

  if(!state.questionsLoaded || state.currentQuestionBank !== selectedModeConfig.file){
    setStatus('Aguarde: carregando o banco de perguntas...', 'warn');
    await loadQuestions(selectedMode, true);
    if(!state.questionsLoaded){
      alert(`Ainda não foi possível carregar as perguntas. Confira se o arquivo ${selectedModeConfig.file} está na mesma pasta do index.html.`);
      return;
    }
  }

  state.quizMode = selectedMode;
  state.currentQuestionBank = selectedModeConfig.file;
  state.playerName = name;
  state.playerGroup = group || 'Sem VTR';
  state.currentQuestion = null;
  state.sessionQuestionIds = [];
  state.patternIndex = 0;
  state.score = 0;
  state.correct = 0;
  state.answered = 0;
  state.mistakes = 0;
  state.streak = 0;
  state.startedAt = new Date();
  state.endedAt = null;
  state.lastAnswerCorrect = false;
  state.gameLockedByError = false;
  state.lastSaveMode = '';

  $('hudPlayer').textContent = state.playerName;
  showScreen('screenGame');
  renderNextQuestion();
}

function renderNextQuestion(){
  if(state.gameLockedByError) return;
  const q = pickNextQuestion();
  if(!q){
    alert('Não há perguntas suficientes para iniciar o desafio.');
    showScreen('screenStart');
    return;
  }

  state.currentQuestion = q;
  $('hudScore').textContent = state.score;
  $('hudQuestionCount').textContent = `Missão ${state.answered + 1}`;
  $('hudLevel').textContent = `Sequência: ${state.correct} acerto${state.correct === 1 ? '' : 's'}`;
  $('hudCategory').textContent = String(q.categoria || 'Geral').replaceAll('_',' ');
  $('questionText').textContent = q.pergunta;
  $('progressFill').style.width = `${Math.max(8, (((state.answered % CONFIG.learningPattern.length) + 1) / CONFIG.learningPattern.length) * 100)}%`;

  const answers = $('answers');
  answers.innerHTML = '';
  shuffle(q.alternativas || []).forEach(alt => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = alt;
    btn.addEventListener('click', () => answerQuestion(alt));
    answers.appendChild(btn);
  });
}

function answerQuestion(answer){
  if(state.gameLockedByError) return;
  const q = state.currentQuestion;
  if(!q) return;

  const isCorrect = answer === q.correta;
  state.lastAnswerCorrect = isCorrect;
  state.answered += 1;

  if(isCorrect){
    state.correct += 1;
    state.streak += 1;
    const base = CONFIG.points[q.nivel] || 10;
    const bonus = state.streak > 1 ? (state.streak - 1) * CONFIG.bonusPerStreak : 0;
    state.score += base + bonus;
  } else {
    state.mistakes += 1;
    state.streak = 0;
    state.gameLockedByError = true;
  }

  $('hudScore').textContent = state.score;
  const feedbackCard = $('feedbackCard');
  feedbackCard.classList.remove('feedback-success', 'feedback-wrong');
  void feedbackCard.offsetWidth;
  feedbackCard.classList.toggle('wrong', !isCorrect);
  feedbackCard.classList.add(isCorrect ? 'feedback-success' : 'feedback-wrong');
  $('feedbackIcon').textContent = isCorrect ? '✓' : '×';
  $('feedbackTitle').textContent = isCorrect ? 'Acerto confirmado!' : 'Primeiro erro!';

  if(isCorrect){
    $('feedbackExplanation').innerHTML = `${escapeHtml(q.explicacao || '')}<br><br><strong>Siga na missão:</strong> o desafio continua enquanto você mantiver a sequência de acertos.`;
    $('btnNext').classList.remove('hidden');
    $('btnRetryAfterError').classList.add('hidden');
    $('btnFinishSave').classList.add('hidden');
  } else {
    $('feedbackExplanation').innerHTML = `${escapeHtml(q.explicacao || '')}<br><br><strong>Resposta correta:</strong> ${escapeHtml(q.correta)}<br><br>Agora você pode reiniciar a missão do zero ou finalizar para registrar sua pontuação no ranking.`;
    $('btnNext').classList.add('hidden');
    $('btnRetryAfterError').classList.remove('hidden');
    $('btnFinishSave').classList.remove('hidden');
  }

  showScreen('screenFeedback');
}

function nextQuestion(){
  showScreen('screenGame');
  renderNextQuestion();
}

async function finishAndSave(){
  state.endedAt = new Date();
  $('progressFill').style.width = '100%';
  const totalAnswered = state.answered || 0;
  const percent = totalAnswered ? Math.round((state.correct / totalAnswered) * 100) : 0;

  $('resultSummary').textContent = `${state.playerName}, você conquistou ${state.correct} acerto${state.correct === 1 ? '' : 's'} antes do primeiro erro.`;
  $('resultScore').textContent = state.score;
  $('resultCorrect').textContent = `${state.correct}/${totalAnswered}`;
  $('resultPercent').textContent = `${percent}%`;
  setSaveStatus('Gravando resultado...', 'warn');

  showScreen('screenResult');

  const saveResult = await saveScore({
    playerName: state.playerName,
    playerGroup: state.playerGroup,
    quizMode: state.quizMode || 'dificil',
    quizModeLabel: getModeConfig(state.quizMode).label,
    questionBank: state.currentQuestionBank || getModeConfig(state.quizMode).file,
    score: Number(state.score || 0),
    correct: Number(state.correct || 0),
    total: Number(totalAnswered || 0),
    percent: Number(percent || 0),
    mistakes: Number(state.mistakes || 0),
    endedBy: 'primeiro_erro',
    startedAt: state.startedAt ? state.startedAt.toISOString() : new Date().toISOString(),
    endedAt: state.endedAt ? state.endedAt.toISOString() : new Date().toISOString(),
    createdAt: new Date().toISOString(),
    questions: state.sessionQuestionIds
  });

  if(saveResult.mode === 'online'){
    setSaveStatus('Pontuação gravada com sucesso. O ranking ficará disponível para todos os dispositivos.', 'ok');
  } else {
    setSaveStatus(`Pontuação salva apenas neste dispositivo. Motivo: ${saveResult.message || 'Firebase não conectado.'}`, 'warn');
  }
}

async function saveScore(payload){
  if(firebaseReady && db && fire){
    try {
      const { addDoc, collection, serverTimestamp } = fire;
      await addDoc(collection(db, 'resultados'), {...payload, createdAtServer: serverTimestamp()});
      return { mode: 'online' };
    } catch (err) {
      console.warn('Falha ao salvar no Firestore. Salvando localmente.', err);
      const msg = String(err?.message || err?.code || 'erro desconhecido');
      saveLocalScore(payload);
      return { mode: 'local', message: msg };
    }
  }

  saveLocalScore(payload);
  return { mode: 'local', message: firebaseEnabled ? 'Firebase ativado, porém sem conexão com o Firestore.' : 'Firebase desativado no firebase-config.js.' };
}

function saveLocalScore(payload){
  const scores = JSON.parse(localStorage.getItem(CONFIG.localKeys.scores) || '[]');
  scores.push(payload);
  localStorage.setItem(CONFIG.localKeys.scores, JSON.stringify(scores));
}

async function loadRanking(){
  let scores = [];
  let source = 'local';

  if(firebaseReady && db && fire){
    try {
      const { collection, getDocs, limit, orderBy, query } = fire;
      const q = query(collection(db, 'resultados'), orderBy('score', 'desc'), limit(30));
      const snap = await getDocs(q);
      scores = snap.docs.map(doc => doc.data());
      source = 'online';
    } catch (err) {
      console.warn('Falha ao carregar ranking do Firestore. Usando ranking local.', err);
      source = `local (${String(err?.message || err?.code || 'falha no Firestore')})`;
    }
  }

  if(!scores.length){
    scores = JSON.parse(localStorage.getItem(CONFIG.localKeys.scores) || '[]');
    if(source === 'online') source = 'online sem registros';
  }

  scores = scores
    .sort((a,b) => (Number(b.score || 0) - Number(a.score || 0)) || (Number(b.correct || 0) - Number(a.correct || 0)))
    .slice(0,30);

  renderRanking(scores, source);
  showScreen('screenRank');
}

function medalForPosition(position){
  if(position === 1) return '🥇';
  if(position === 2) return '🥈';
  if(position === 3) return '🥉';
  return '🏅';
}

function renderPodium(scores){
  const podium = $('rankPodium');
  if(!podium) return;
  podium.innerHTML = '';

  const topThree = scores.slice(0,3);
  if(!topThree.length){
    podium.innerHTML = '<p class="rank-meta">Ainda não há pontuações suficientes para o pódio.</p>';
    return;
  }

  const order = [1,0,2].filter(index => topThree[index]);
  order.forEach(index => {
    const item = topThree[index];
    const pos = index + 1;
    const card = document.createElement('div');
    card.className = `podium-item ${pos === 1 ? 'first' : ''}`;
    card.innerHTML = `
      <div class="podium-rank">${medalForPosition(pos)}</div>
      <div class="podium-name">${escapeHtml(item.playerName || 'MILITAR')}</div>
      <div class="podium-mode">${modeBadgeHtml(item)}</div>
      <div class="podium-vtr">${escapeHtml(item.playerGroup || 'Sem VTR')}</div>
      <div class="podium-score">${item.score || 0}</div>`;
    podium.appendChild(card);
  });
}

function renderRanking(scores, source = ''){
  const list = $('rankList');
  list.innerHTML = '';
  renderPodium(scores);

  if(!scores.length){
    const empty = document.createElement('p');
    empty.className = 'rank-meta';
    empty.textContent = 'Ainda não há pontuações registradas no ranking.';
    list.appendChild(empty);
    return;
  }

  const listScores = scores.slice(3).length ? scores.slice(3) : scores;

  listScores.forEach((item, index) => {
    const actualPosition = scores.slice(3).length ? index + 4 : index + 1;
    const row = document.createElement('div');
    row.className = `rank-item ${actualPosition <= 3 ? 'top-rank' : ''}`;
    row.innerHTML = `
      <div class="rank-pos">#${actualPosition}</div>
      <div>
        <div class="rank-name">${escapeHtml(item.playerName || 'MILITAR')}</div>
        <div class="rank-meta">${escapeHtml(item.playerGroup || 'Sem VTR')} • ${item.correct || 0} acerto${Number(item.correct || 0) === 1 ? '' : 's'} <span class="rank-mode">${modeBadgeHtml(item)}</span></div>
      </div>
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

  const q = state.currentQuestion;
  if(!q){ return; }

  const payload = {
    questionId: Number(q.id),
    questionText: q.pergunta,
    correctAnswer: q.correta,
    playerName: state.playerName || 'Não informado',
    playerGroup: state.playerGroup || 'Sem VTR',
    reportText: text,
    createdAt: new Date().toISOString()
  };

  if(firebaseReady && db && fire){
    try {
      const { addDoc, collection, serverTimestamp } = fire;
      await addDoc(collection(db, 'recursos_questoes'), {...payload, createdAtServer: serverTimestamp()});
      $('reportDialog').close();
      alert('Recurso registrado no banco online. Obrigado por ajudar a melhorar o quiz!');
      return;
    } catch (err) {
      console.warn('Falha ao salvar recurso no Firestore. Salvando localmente.', err);
    }
  }

  const reports = JSON.parse(localStorage.getItem(CONFIG.localKeys.reports) || '[]');
  reports.push(payload);
  localStorage.setItem(CONFIG.localKeys.reports, JSON.stringify(reports));
  $('reportDialog').close();
  alert('Recurso registrado localmente. O Firebase ainda não está gravando online neste dispositivo.');
}

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[t]));
}

function bindEvents(){
  $('btnStart')?.addEventListener('click', startGame);
  $('btnNext')?.addEventListener('click', nextQuestion);
  $('btnRetryAfterError')?.addEventListener('click', startGame);
  $('btnFinishSave')?.addEventListener('click', finishAndSave);
  $('btnRestart')?.addEventListener('click', startGame);
  $('btnShowRank')?.addEventListener('click', loadRanking);
  $('btnShowRankStart')?.addEventListener('click', loadRanking);
  $('btnBackHome')?.addEventListener('click', () => showScreen('screenStart'));
  $('btnReport')?.addEventListener('click', openReport);
  $('btnSendReport')?.addEventListener('click', sendReport);

  document.querySelectorAll('input[name="quizMode"]').forEach(input => {
    input.addEventListener('change', async () => {
      updateModeVisualState();
      await loadQuestions(getSelectedQuizMode(), true);
    });
  });
  updateModeVisualState();

  $('playerName')?.addEventListener('keydown', (ev) => { if(ev.key === 'Enter') $('playerGroup')?.focus(); });
  $('playerGroup')?.addEventListener('keydown', (ev) => { if(ev.key === 'Enter') startGame(); });
}

bindEvents();
loadQuestions(getSelectedQuizMode(), true);
initFirebase();
