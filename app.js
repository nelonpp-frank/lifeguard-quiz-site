(() => {
  'use strict';

  const BANK = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
  const app = document.querySelector('#app');
  const tabs = document.querySelectorAll('.tab');
  const STORAGE_WRONG = 'lifeguardQuizWrongV1';

  const state = {
    view: 'quiz',
    quiz: [],
    answers: {},
    submitted: false,
    message: '',
    config: {
      count: '25',
      chapter: 'all',
      type: 'mixed'
    },
    allFilters: {
      search: '',
      chapter: 'all',
      type: 'all'
    },
    quizMode: 'normal',
    quizTitle: '隨機',
    quizPoolLabel: '目前題庫可抽',
    quizPoolSize: 0
  };

  const chapters = [...new Set(BANK.map(q => q.chapter).filter(Boolean))];

  function escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function formatChapterOptions(selected) {
    return [
      '<option value="all">全部章節</option>',
      ...chapters.map(ch => `<option value="${escapeHTML(ch)}" ${selected === ch ? 'selected' : ''}>${escapeHTML(ch)}</option>`)
    ].join('');
  }

  function getWrongStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_WRONG) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function setWrongStore(store) {
    localStorage.setItem(STORAGE_WRONG, JSON.stringify(store));
  }

  function poolByConfig(config) {
    return BANK.filter(q => {
      const chapterOk = config.chapter === 'all' || q.chapter === config.chapter;
      const typeOk = config.type === 'mixed' || config.type === 'all' || q.type === config.type;
      return chapterOk && typeOk;
    });
  }

  function sampleQuestions(pool, count, type) {
    if (count === 'all') return shuffle(pool);
    const n = Math.max(1, Number.parseInt(count, 10) || 25);
    const all = shuffle(pool);

    if (type !== 'mixed') {
      return all.slice(0, n);
    }

    const tf = shuffle(pool.filter(q => q.type === 'tf'));
    const choice = shuffle(pool.filter(q => q.type === 'choice'));
    const tfTarget = Math.floor(n / 2);
    const choiceTarget = n - tfTarget;

    const selected = [
      ...tf.slice(0, tfTarget),
      ...choice.slice(0, choiceTarget)
    ];

    if (selected.length < n) {
      const used = new Set(selected.map(q => q.id));
      const filler = all.filter(q => !used.has(q.id)).slice(0, n - selected.length);
      selected.push(...filler);
    }

    return shuffle(selected).slice(0, n);
  }

  function newQuiz(config = state.config, sourcePool = null, meta = {}) {
    const pool = sourcePool || poolByConfig(config);
    state.quiz = sampleQuestions(pool, config.count, config.type);
    state.answers = {};
    state.submitted = false;
    state.message = '';
    state.quizMode = meta.mode || 'normal';
    state.quizTitle = meta.title || '隨機';
    state.quizPoolLabel = meta.poolLabel || '目前題庫可抽';
    state.quizPoolSize = pool.length;
  }

  function questionCounts(items = state.quiz) {
    return {
      total: items.length,
      tf: items.filter(q => q.type === 'tf').length,
      choice: items.filter(q => q.type === 'choice').length
    };
  }

  function answerText(q, key) {
    const option = q.options.find(o => o.key === key);
    if (!option) return key;
    return q.type === 'tf' ? `${key}（${option.text}）` : `${key}. ${option.text}`;
  }

  function updateTabs() {
    tabs.forEach(tab => {
      tab.classList.toggle('is-active', tab.dataset.view === state.view);
    });
  }

  function switchView(view) {
    state.view = view;
    state.message = '';
    updateTabs();
    render();
    app.focus({ preventScroll: true });
  }

  function updateProgress() {
    const total = state.quiz.length || 1;
    const answered = Object.keys(state.answers).length;
    const percent = Math.round((answered / total) * 100);
    const text = document.querySelector('[data-progress-text]');
    const bar = document.querySelector('[data-progress-bar]');
    if (text) text.textContent = `已作答 ${answered} / ${state.quiz.length}`;
    if (bar) bar.style.width = `${percent}%`;
  }

  function renderQuizView() {
    if (!state.quiz.length) newQuiz();
    const counts = questionCounts();
    const poolTotal = state.quizPoolSize || poolByConfig(state.config).length;
    const answered = Object.keys(state.answers).length;

    const resultHTML = state.submitted ? renderResultCard() : '';
    const messageHTML = state.message ? `<div class="notice">${escapeHTML(state.message)}</div>` : '';

    app.innerHTML = `
      <section class="panel">
        <h2>${escapeHTML(state.quizTitle)} ${counts.total} 題</h2>
        <p>每次測驗會從題庫抽題，提交後顯示分數、正確答案，答錯題目會自動加入錯題複習。</p>
        <div class="controls">
          <div class="field">
            <label for="countSelect">題數</label>
            <select id="countSelect" data-control="count">
              ${['10','25','50','100','all'].map(v => `<option value="${v}" ${state.config.count === v ? 'selected' : ''}>${v === 'all' ? '全部' : `${v} 題`}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="chapterSelect">章節</label>
            <select id="chapterSelect" data-control="chapter">${formatChapterOptions(state.config.chapter)}</select>
          </div>
          <div class="field">
            <label for="typeSelect">題型</label>
            <select id="typeSelect" data-control="type">
              <option value="mixed" ${state.config.type === 'mixed' ? 'selected' : ''}>是非＋選擇</option>
              <option value="tf" ${state.config.type === 'tf' ? 'selected' : ''}>只出是非題</option>
              <option value="choice" ${state.config.type === 'choice' ? 'selected' : ''}>只出選擇題</option>
            </select>
          </div>
          <button class="btn" type="button" data-action="new-quiz">重新出題</button>
        </div>
        <div class="summary-row">
          <span class="pill">${escapeHTML(state.quizPoolLabel)} ${poolTotal} 題</span>
          <span class="pill muted">本次是非題 ${counts.tf} 題</span>
          <span class="pill muted">本次選擇題 ${counts.choice} 題</span>
        </div>
        ${messageHTML}
      </section>

      ${resultHTML}

      <div class="progress-wrap">
        <div class="progress-box">
          <strong data-progress-text>已作答 ${answered} / ${counts.total}</strong>
          <div class="progress-bar" aria-hidden="true"><span data-progress-bar style="width:${Math.round((answered / Math.max(counts.total, 1)) * 100)}%"></span></div>
          <button class="btn secondary" type="button" data-action="submit-quiz" ${state.submitted ? 'disabled' : ''}>提交答案</button>
        </div>
      </div>

      <form class="quiz-list" data-quiz-form>
        ${state.quiz.map((q, index) => renderQuestionCard(q, index, { interactive: !state.submitted })).join('')}
      </form>
    `;
  }

  function renderResultCard() {
    const correct = state.quiz.filter(q => state.answers[q.id] === q.answer).length;
    const total = state.quiz.length;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    const wrongCount = total - correct;
    return `
      <section class="result-card" aria-live="polite">
        <div class="result-score">
          <strong>${percent}</strong>
          <span>分｜答對 ${correct} / ${total} 題，錯 ${wrongCount} 題</span>
        </div>
        <div class="actions">
          <button class="btn" type="button" data-action="new-quiz">重新出題</button>
          <button class="btn secondary" type="button" data-action="start-wrong">錯題複習</button>
          <button class="btn ghost" type="button" data-view-link="all">查看全部題目</button>
        </div>
      </section>
    `;
  }

  function renderQuestionCard(q, index, options = {}) {
    const selected = state.answers[q.id] || '';
    const submitted = state.submitted;
    const isCorrect = submitted && selected === q.answer;
    const isWrong = submitted && selected !== q.answer;
    const cardClass = submitted ? (isCorrect ? ' is-correct' : ' is-wrong') : '';
    const meta = `${q.chapter} / ${q.section} / ${q.typeName} ${q.sourceNumber}`;

    return `
      <article class="question-card${cardClass}" data-question-id="${escapeHTML(q.id)}">
        <div class="question-meta">
          <span class="pill muted">${index + 1}</span>
          <span>${escapeHTML(meta)}</span>
        </div>
        <h3 class="question-title">${escapeHTML(q.question)}</h3>
        <ul class="options">
          ${q.options.map(o => renderOption(q, o, selected, options.interactive)).join('')}
        </ul>
        ${submitted ? `
          <div class="answer-line">
            ${isCorrect ? '答對了。' : `你的答案：${selected ? escapeHTML(answerText(q, selected)) : '未作答'}。`}
            正確答案：<strong>${escapeHTML(answerText(q, q.answer))}</strong>
          </div>
        ` : ''}
      </article>
    `;
  }

  function renderOption(q, option, selected, interactive) {
    const isSelected = selected === option.key;
    const isAnswer = state.submitted && option.key === q.answer;
    const isMissed = state.submitted && isSelected && selected !== q.answer;
    const optionClass = [
      'option',
      isSelected ? 'is-selected' : '',
      isAnswer ? 'is-answer' : '',
      isMissed ? 'is-missed' : ''
    ].filter(Boolean).join(' ');

    return `
      <li>
        <label class="${optionClass}">
          <input type="radio" name="q_${escapeHTML(q.id)}" value="${escapeHTML(option.key)}" ${isSelected ? 'checked' : ''} ${interactive ? '' : 'disabled'} />
          <span><strong>${escapeHTML(option.key)}.</strong> ${escapeHTML(option.text)}</span>
        </label>
      </li>
    `;
  }

  function submitQuiz() {
    const unanswered = state.quiz.filter(q => !state.answers[q.id]);
    if (unanswered.length) {
      state.message = `還有 ${unanswered.length} 題未作答，請完成後再提交。`;
      render();
      return;
    }

    const wrongStore = getWrongStore();
    const now = new Date().toISOString();
    state.quiz.forEach(q => {
      if (state.answers[q.id] === q.answer) {
        delete wrongStore[q.id];
      } else {
        const old = wrongStore[q.id] || { count: 0 };
        wrongStore[q.id] = {
          count: (old.count || 0) + 1,
          lastMissedAt: now
        };
      }
    });
    setWrongStore(wrongStore);
    state.submitted = true;
    state.message = '';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderAllView() {
    const filtered = getAllFilteredQuestions();
    app.innerHTML = `
      <section class="panel">
        <h2>全部題目</h2>
        <p>題庫共 ${BANK.length} 題。可用章節、題型或關鍵字快速搜尋。</p>
        <div class="search-grid">
          <div class="field">
            <label for="searchInput">關鍵字</label>
            <input id="searchInput" type="search" data-all-filter="search" value="${escapeHTML(state.allFilters.search)}" placeholder="輸入題目或選項文字" />
          </div>
          <div class="field">
            <label for="allChapterSelect">章節</label>
            <select id="allChapterSelect" data-all-filter="chapter">${formatChapterOptions(state.allFilters.chapter)}</select>
          </div>
          <div class="field">
            <label for="allTypeSelect">題型</label>
            <select id="allTypeSelect" data-all-filter="type">
              <option value="all" ${state.allFilters.type === 'all' ? 'selected' : ''}>全部題型</option>
              <option value="tf" ${state.allFilters.type === 'tf' ? 'selected' : ''}>是非題</option>
              <option value="choice" ${state.allFilters.type === 'choice' ? 'selected' : ''}>選擇題</option>
            </select>
          </div>
        </div>
        <div class="summary-row">
          <span class="pill">目前顯示 ${filtered.length} 題</span>
        </div>
      </section>
      ${filtered.length ? `<div class="details-list">${filtered.map((q, index) => renderDetailsQuestion(q, index)).join('')}</div>` : '<div class="panel empty">找不到符合條件的題目。</div>'}
    `;
  }

  function getAllFilteredQuestions() {
    const keyword = state.allFilters.search.trim().toLowerCase();
    return BANK.filter(q => {
      const chapterOk = state.allFilters.chapter === 'all' || q.chapter === state.allFilters.chapter;
      const typeOk = state.allFilters.type === 'all' || q.type === state.allFilters.type;
      const text = `${q.chapter} ${q.section} ${q.typeName} ${q.question} ${q.options.map(o => o.text).join(' ')}`.toLowerCase();
      const keywordOk = !keyword || text.includes(keyword);
      return chapterOk && typeOk && keywordOk;
    });
  }

  function renderDetailsQuestion(q, index) {
    return `
      <details class="details-card">
        <summary>${index + 1}. ${escapeHTML(q.question)}</summary>
        <div class="details-card__body">
          <div class="question-meta">${escapeHTML(`${q.chapter} / ${q.section} / ${q.typeName} ${q.sourceNumber}`)}</div>
          <ul class="options">
            ${q.options.map(o => `<li class="option"><span><strong>${escapeHTML(o.key)}.</strong> ${escapeHTML(o.text)}</span></li>`).join('')}
          </ul>
          <div class="answer-line">答案：<strong>${escapeHTML(answerText(q, q.answer))}</strong></div>
        </div>
      </details>
    `;
  }

  function renderWrongView() {
    const store = getWrongStore();
    const ids = Object.keys(store);
    const wrongQuestions = ids.map(id => BANK.find(q => q.id === id)).filter(Boolean);
    const sorted = wrongQuestions.sort((a, b) => {
      const timeA = store[a.id]?.lastMissedAt || '';
      const timeB = store[b.id]?.lastMissedAt || '';
      return timeB.localeCompare(timeA);
    });

    app.innerHTML = `
      <section class="panel">
        <h2>錯題複習</h2>
        <p>答錯的題目會保存在這台裝置的瀏覽器中；複習答對後會自動移出錯題。</p>
        <div class="summary-row">
          <span class="pill">目前錯題 ${sorted.length} 題</span>
        </div>
        <div class="actions">
          <button class="btn" type="button" data-action="start-wrong" ${sorted.length ? '' : 'disabled'}>開始錯題複習</button>
          <button class="btn danger" type="button" data-action="clear-wrong" ${sorted.length ? '' : 'disabled'}>清空錯題</button>
        </div>
      </section>
      ${sorted.length ? `<div class="details-list">${sorted.map((q, index) => renderWrongDetails(q, index, store[q.id])).join('')}</div>` : '<div class="panel empty">目前沒有錯題。做完測驗並提交後，錯題會出現在這裡。</div>'}
    `;
  }

  function renderWrongDetails(q, index, record) {
    const missedText = record?.count ? `錯 ${record.count} 次` : '曾答錯';
    return `
      <details class="details-card">
        <summary>${index + 1}. ${escapeHTML(q.question)}</summary>
        <div class="details-card__body">
          <div class="question-meta">
            <span class="pill muted">${escapeHTML(missedText)}</span>
            <span>${escapeHTML(`${q.chapter} / ${q.section} / ${q.typeName} ${q.sourceNumber}`)}</span>
          </div>
          <ul class="options">
            ${q.options.map(o => `<li class="option"><span><strong>${escapeHTML(o.key)}.</strong> ${escapeHTML(o.text)}</span></li>`).join('')}
          </ul>
          <div class="answer-line">答案：<strong>${escapeHTML(answerText(q, q.answer))}</strong></div>
        </div>
      </details>
    `;
  }

  function startWrongQuiz() {
    const store = getWrongStore();
    const wrongPool = Object.keys(store).map(id => BANK.find(q => q.id === id)).filter(Boolean);
    if (!wrongPool.length) {
      state.view = 'wrong';
      state.message = '';
      updateTabs();
      render();
      return;
    }
    state.config = { count: '25', chapter: 'all', type: 'mixed' };
    newQuiz(state.config, wrongPool, { mode: 'wrong', title: '錯題複習', poolLabel: '錯題題庫可抽' });
    state.view = 'quiz';
    updateTabs();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearWrong() {
    localStorage.removeItem(STORAGE_WRONG);
    render();
  }

  function handleClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const viewLink = event.target.closest('[data-view-link]')?.dataset.viewLink;

    if (viewLink) {
      switchView(viewLink);
      return;
    }

    if (!action) return;

    if (action === 'new-quiz') {
      if (state.quizMode === 'wrong') {
        startWrongQuiz();
      } else {
        newQuiz();
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    if (action === 'submit-quiz') submitQuiz();
    if (action === 'start-wrong') startWrongQuiz();
    if (action === 'clear-wrong') clearWrong();
  }

  function handleChange(event) {
    const control = event.target.dataset.control;
    if (control) {
      state.config[control] = event.target.value;
      newQuiz();
      render();
      return;
    }

    const allFilter = event.target.dataset.allFilter;
    if (allFilter) {
      state.allFilters[allFilter] = event.target.value;
      renderAllView();
      return;
    }

    const radio = event.target.matches('input[type="radio"][name^="q_"]') ? event.target : null;
    if (radio) {
      const id = radio.name.replace('q_', '');
      state.answers[id] = radio.value;
      const card = radio.closest('.question-card');
      if (card) {
        card.querySelectorAll('.option').forEach(label => label.classList.remove('is-selected'));
        radio.closest('.option')?.classList.add('is-selected');
      }
      updateProgress();
    }
  }

  function handleInput(event) {
    const allFilter = event.target.dataset.allFilter;
    if (allFilter === 'search') {
      state.allFilters.search = event.target.value;
      renderAllView();
      const input = document.querySelector('[data-all-filter="search"]');
      if (input) {
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    }
  }

  function render() {
    updateTabs();
    if (state.view === 'quiz') renderQuizView();
    if (state.view === 'all') renderAllView();
    if (state.view === 'wrong') renderWrongView();
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });
  app.addEventListener('click', handleClick);
  app.addEventListener('change', handleChange);
  app.addEventListener('input', handleInput);

  render();
})();
