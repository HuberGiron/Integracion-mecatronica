let rubricData = null;
let sections = [];
let memberCounter = 0;

const rubricEl = document.getElementById('rubric');
const membersList = document.getElementById('membersList');
const loadingMessage = document.getElementById('loadingMessage');

function escapeHtml(str = '') {
  return String(str).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function formatNumber(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

function validHttpUrl(value) {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}

function totalBaseWeight() {
  return sections.reduce((sum, section) => sum + section.items.reduce((s, item) => s + (item.weight ?? 1), 0), 0);
}

function totalBaseItems() {
  return sections.reduce((sum, section) => sum + section.items.length, 0);
}

function storageKey() {
  return rubricData?.storageKey || 'integracion-autoevaluacion-v2';
}

function getStatus(itemId) {
  const input = document.querySelector(`.criterion-check[data-id="${CSS.escape(itemId)}"]`);
  const row = document.querySelector(`.criterion[data-id="${CSS.escape(itemId)}"]`);
  if (!input || !row) return 'no';
  if (row.dataset.na === 'true') return 'na';
  return input.checked ? 'ok' : 'no';
}

function setStatus(itemId, status, shouldSave = true) {
  const input = document.querySelector(`.criterion-check[data-id="${CSS.escape(itemId)}"]`);
  const row = document.querySelector(`.criterion[data-id="${CSS.escape(itemId)}"]`);
  if (!input || !row) return;

  const item = sections.flatMap(s => s.items).find(i => i.id === itemId);
  const naAllowed = Boolean(item?.naAllowed);
  const normalized = status === 'na' && naAllowed ? 'na' : status === 'ok' ? 'ok' : 'no';

  row.dataset.na = normalized === 'na' ? 'true' : 'false';
  input.disabled = normalized === 'na';
  input.checked = normalized === 'ok';
  row.classList.toggle('is-na', normalized === 'na');
  const naButton = row.querySelector('.na-button');
  if (naButton) {
    naButton.classList.toggle('is-active', normalized === 'na');
    naButton.setAttribute('aria-pressed', normalized === 'na' ? 'true' : 'false');
  }
  if (shouldSave) updateScore();
}

function tagsHtml(tags = []) {
  const names = rubricData?.tags || {};
  return tags.map(tag => `<span class="tag tag--${escapeHtml(tag)}">${escapeHtml(names[tag] || tag)}</span>`).join('');
}

function renderRubric() {
  let globalIndex = 0;
  rubricEl.innerHTML = sections.map((section, sIndex) => {
    const rows = section.items.map((item, iIndex) => {
      globalIndex += 1;
      const tags = item.tags || [];
      const weight = item.weight ?? 1;
      const naButton = item.naAllowed
        ? `<button type="button" class="na-button" data-na-for="${escapeHtml(item.id)}" aria-pressed="false" title="Excluir este criterio porque no aplica al alcance del proyecto">N/A</button>`
        : '';

      return `
        <div class="criterion" data-id="${escapeHtml(item.id)}" data-section="${sIndex}" data-index="${iIndex}" data-na="false">
          <label class="criterion-check-label" for="criterion-${escapeHtml(item.id)}">
            <input id="criterion-${escapeHtml(item.id)}" class="criterion-check" type="checkbox" data-id="${escapeHtml(item.id)}" data-section="${sIndex}" />
            <span class="check-ui" aria-hidden="true"></span>
          </label>
          <label class="criterion-content" for="criterion-${escapeHtml(item.id)}">
            <strong>${globalIndex}. ${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.detail || '')}</small>
            ${tags.length ? `<span class="tags">${tagsHtml(tags)}</span>` : ''}
          </label>
          <div class="criterion-actions">
            ${naButton}
            <span class="criterion-points">${formatNumber(weight)} pt</span>
          </div>
        </div>`;
    }).join('');

    const sectionWeight = section.items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    return `
      <article class="rubric-section" data-section-card="${sIndex}">
        <header class="rubric-section__header">
          <span class="section-index">${String(sIndex + 1).padStart(2, '0')}</span>
          <div>
            <h2>${escapeHtml(section.title)}</h2>
            <p>${escapeHtml(section.description || '')}</p>
          </div>
          <div class="section-score">
            <strong id="sectionScore-${sIndex}">0 / ${section.items.length}</strong>
            <span id="sectionMeta-${sIndex}">${formatNumber(sectionWeight)} pt base</span>
          </div>
        </header>
        <div class="criteria">${rows}</div>
      </article>`;
  }).join('');

  document.querySelectorAll('.criterion-check').forEach(input => {
    input.addEventListener('change', () => {
      const id = input.dataset.id;
      const row = input.closest('.criterion');
      if (row?.dataset.na === 'true') setStatus(id, 'no', false);
      updateScore();
    });
  });

  document.querySelectorAll('.na-button').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.naFor;
      const current = getStatus(id);
      setStatus(id, current === 'na' ? 'no' : 'na');
    });
  });
}

function addMember(value = '') {
  memberCounter += 1;
  const row = document.createElement('div');
  row.className = 'member-row';
  row.innerHTML = `
    <span class="member-number"></span>
    <input type="text" class="member-input" placeholder="Nombre completo" value="${escapeHtml(value)}" />
    <button type="button" class="icon-button remove-member" aria-label="Eliminar integrante">×</button>`;

  row.querySelector('.remove-member').addEventListener('click', () => {
    if (membersList.children.length <= 1) {
      row.querySelector('input').value = '';
      saveState();
      return;
    }
    row.remove();
    renumberMembers();
    saveState();
  });
  row.querySelector('input').addEventListener('input', saveState);
  membersList.appendChild(row);
  renumberMembers();
}

function renumberMembers() {
  [...membersList.children].forEach((row, idx) => {
    row.querySelector('.member-number').textContent = idx + 1;
  });
}

function getMembers() {
  return [...document.querySelectorAll('.member-input')]
    .map(i => i.value.trim())
    .filter(Boolean);
}

function calculateScores() {
  let earnedWeight = 0;
  let applicableWeight = 0;
  let applicableItems = 0;
  let okItems = 0;
  let naItems = 0;

  const bySection = sections.map(section => {
    let sectionEarned = 0;
    let sectionApplicableWeight = 0;
    let sectionApplicableItems = 0;
    let sectionOk = 0;
    let sectionNa = 0;

    section.items.forEach(item => {
      const weight = item.weight ?? 1;
      const status = getStatus(item.id);
      if (status === 'na') {
        naItems += 1;
        sectionNa += 1;
        return;
      }
      applicableItems += 1;
      sectionApplicableItems += 1;
      applicableWeight += weight;
      sectionApplicableWeight += weight;
      if (status === 'ok') {
        okItems += 1;
        sectionOk += 1;
        earnedWeight += weight;
        sectionEarned += weight;
      }
    });

    const percent = sectionApplicableWeight > 0 ? (sectionEarned / sectionApplicableWeight) * 100 : 0;
    return {
      section,
      earnedWeight: sectionEarned,
      applicableWeight: sectionApplicableWeight,
      applicableItems: sectionApplicableItems,
      okItems: sectionOk,
      naItems: sectionNa,
      percent
    };
  });

  const score = applicableWeight > 0 ? (earnedWeight / applicableWeight) * 100 : 0;
  return {
    score,
    earnedWeight,
    applicableWeight,
    applicableItems,
    okItems,
    naItems,
    bySection
  };
}

function updateScore() {
  if (!rubricData) return;
  const s = calculateScores();
  const scoreRounded = Math.round(s.score);
  document.getElementById('scoreTop').textContent = `${scoreRounded}%`;
  document.getElementById('scoreSticky').textContent = `${scoreRounded}%`;
  document.getElementById('scoreCount').textContent = `${s.okItems} / ${s.applicableItems} criterios aplicables`;
  document.getElementById('applicableCount').textContent = `${s.applicableItems} criterios aplicables · ${s.naItems} N/A`;
  document.getElementById('progressBar').style.width = `${clamp(s.score, 0, 100)}%`;

  s.bySection.forEach((sectionScore, sIndex) => {
    const scoreEl = document.getElementById(`sectionScore-${sIndex}`);
    const metaEl = document.getElementById(`sectionMeta-${sIndex}`);
    if (scoreEl) scoreEl.textContent = `${sectionScore.okItems} / ${sectionScore.applicableItems}`;
    if (metaEl) {
      const pct = sectionScore.applicableItems ? Math.round(sectionScore.percent) : 0;
      metaEl.textContent = `${pct}% · ${sectionScore.naItems} N/A`;
    }
  });
  saveState();
}

function validateBeforeReport() {
  const project = document.getElementById('projectName');
  const url = document.getElementById('projectUrl');
  const members = getMembers();
  const errors = [];

  [project, url].forEach(el => el.classList.remove('invalid'));
  if (!project.value.trim()) {
    project.classList.add('invalid');
    errors.push('nombre del proyecto');
  }
  if (!validHttpUrl(url.value.trim())) {
    url.classList.add('invalid');
    errors.push('liga válida');
  }
  if (!members.length) errors.push('al menos un integrante');

  if (errors.length) {
    showToast(`Falta completar: ${errors.join(', ')}.`);
    document.querySelector('.project-data').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return false;
  }
  return true;
}

function generateReport() {
  if (!rubricData || !validateBeforeReport()) return;
  const s = calculateScores();
  const project = document.getElementById('projectName').value.trim();
  const url = document.getElementById('projectUrl').value.trim();
  const members = getMembers();
  const scoreRounded = Math.round(s.score);

  document.getElementById('reportScore').textContent = `${scoreRounded}%`;
  document.getElementById('reportCount').textContent = `${s.okItems} / ${s.applicableItems} aplicables · ${s.naItems} N/A`;
  document.getElementById('reportProject').textContent = project;
  document.getElementById('reportMembers').textContent = members.join(' · ');
  document.getElementById('reportRubricVersion').textContent = rubricData.version || '—';

  const link = document.getElementById('reportUrl');
  link.textContent = url;
  link.href = url;

  const now = new Date();
  document.getElementById('reportDate').textContent = `Generado el ${new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long', timeStyle: 'short'
  }).format(now)}`;

  document.getElementById('reportSummary').innerHTML = s.bySection.map((sectionScore, sIndex) => {
    const pct = sectionScore.applicableItems ? Math.round(sectionScore.percent) : 0;
    return `<div class="summary-item">
      <span>${sIndex + 1}. ${escapeHtml(sectionScore.section.title)}</span>
      <strong>${sectionScore.okItems}/${sectionScore.applicableItems} · ${pct}%${sectionScore.naItems ? ` · ${sectionScore.naItems} N/A` : ''}</strong>
    </div>`;
  }).join('');

  let global = 0;
  document.getElementById('reportDetails').innerHTML = sections.map((section, sIndex) => {
    const sectionRows = section.items.map(item => {
      global += 1;
      const status = getStatus(item.id);
      const weight = item.weight ?? 1;
      const statusText = status === 'ok' ? '✓' : status === 'na' ? 'N/A' : '—';
      const statusClass = status === 'ok' ? 'ok' : status === 'na' ? 'na' : 'no';
      const pointText = status === 'na' ? 'excl.' : status === 'ok' ? `${formatNumber(weight)} pt` : '0 pt';
      return `<li class="report-row">
        <span class="report-status ${statusClass}">${statusText}</span>
        <span>${global}. ${escapeHtml(item.title)}</span>
        <span class="point">${pointText}</span>
      </li>`;
    }).join('');

    const ss = s.bySection[sIndex];
    const pct = ss.applicableItems ? Math.round(ss.percent) : 0;
    return `<div class="report-topic">
      <div class="report-topic__head">
        <h3>${sIndex + 1}. ${escapeHtml(section.title)}</h3>
        <strong>${ss.okItems}/${ss.applicableItems} · ${pct}%</strong>
      </div>
      <ul class="report-list">${sectionRows}</ul>
    </div>`;
  }).join('');

  const declared = document.getElementById('declaration').checked;
  document.getElementById('reportDeclaration').textContent = declared
    ? 'El equipo confirmó que las evidencias marcadas están disponibles en la liga indicada y corresponden con la versión presentada.'
    : 'La casilla de declaración del equipo no fue confirmada al momento de generar este reporte.';

  document.getElementById('reportFooterText').textContent = `Rúbrica v${rubricData.version || '—'} · ${totalBaseItems()} criterios base · puntuación normalizada sobre criterios aplicables.`;

  document.querySelector('main').style.display = 'none';
  document.querySelector('.hero').style.display = 'none';
  const report = document.getElementById('report');
  report.classList.add('is-visible');
  report.setAttribute('aria-hidden', 'false');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToRubric() {
  document.getElementById('report').classList.remove('is-visible');
  document.getElementById('report').setAttribute('aria-hidden', 'true');
  document.querySelector('main').style.display = '';
  document.querySelector('.hero').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetAll() {
  if (!confirm('¿Deseas borrar toda la autoevaluación y comenzar de nuevo?')) return;
  localStorage.removeItem(storageKey());
  document.getElementById('projectName').value = '';
  document.getElementById('projectUrl').value = '';
  document.getElementById('declaration').checked = false;
  membersList.innerHTML = '';
  addMember(); addMember(); addMember();
  sections.flatMap(s => s.items).forEach(item => setStatus(item.id, 'no', false));
  updateScore();
  showToast('Autoevaluación reiniciada.');
}

function collectCriterionState() {
  const out = {};
  sections.flatMap(s => s.items).forEach(item => {
    out[item.id] = getStatus(item.id);
  });
  return out;
}

function saveState() {
  if (!rubricData) return;
  const state = {
    rubricVersion: rubricData.version || '',
    project: document.getElementById('projectName')?.value || '',
    url: document.getElementById('projectUrl')?.value || '',
    members: getMembers(),
    criteria: collectCriterionState(),
    declaration: document.getElementById('declaration')?.checked || false
  };
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

function loadState() {
  membersList.innerHTML = '';
  const raw = localStorage.getItem(storageKey());
  if (!raw) {
    addMember(); addMember(); addMember();
    return;
  }

  try {
    const state = JSON.parse(raw);
    document.getElementById('projectName').value = state.project || '';
    document.getElementById('projectUrl').value = state.url || '';
    (state.members?.length ? state.members : ['', '', '']).forEach(addMember);
    Object.entries(state.criteria || {}).forEach(([id, status]) => setStatus(id, status, false));
    document.getElementById('declaration').checked = Boolean(state.declaration);
  } catch {
    addMember(); addMember(); addMember();
  }
}

let toastTimer;
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function bindStaticEvents() {
  document.getElementById('addMember').addEventListener('click', () => {
    addMember();
    saveState();
  });
  document.getElementById('projectName').addEventListener('input', saveState);
  document.getElementById('projectUrl').addEventListener('input', e => {
    e.target.classList.remove('invalid');
    document.getElementById('urlStatus').textContent = validHttpUrl(e.target.value.trim())
      ? 'Liga válida para incluir en el reporte.'
      : 'Debe ser una liga accesible para revisión.';
    saveState();
  });
  document.getElementById('declaration').addEventListener('change', saveState);
  document.getElementById('markNone').addEventListener('click', () => {
    sections.flatMap(s => s.items).forEach(item => setStatus(item.id, 'no', false));
    updateScore();
  });
  document.getElementById('resetAll').addEventListener('click', resetAll);
  document.getElementById('generateReport').addEventListener('click', generateReport);
  document.getElementById('generateReportBottom').addEventListener('click', generateReport);
  document.getElementById('backToRubric').addEventListener('click', backToRubric);
  document.getElementById('printReport').addEventListener('click', () => window.print());
}

function validateRubricJson(data) {
  if (!data || !Array.isArray(data.sections) || !data.sections.length) {
    throw new Error('rubric.json no contiene una lista válida de secciones.');
  }
  const ids = new Set();
  data.sections.forEach(section => {
    if (!Array.isArray(section.items)) throw new Error(`La sección ${section.title || section.id} no contiene items.`);
    section.items.forEach(item => {
      if (!item.id || !item.title) throw new Error('Todos los criterios necesitan id y title.');
      if (ids.has(item.id)) throw new Error(`ID duplicado en rubric.json: ${item.id}`);
      ids.add(item.id);
      if (item.weight !== undefined && (!(item.weight > 0) || !Number.isFinite(item.weight))) {
        throw new Error(`Peso inválido en ${item.id}.`);
      }
    });
  });
}

async function init() {
  bindStaticEvents();
  try {
    const response = await fetch('./rubric.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo cargar rubric.json (${response.status}).`);
    const data = await response.json();
    validateRubricJson(data);
    rubricData = data;
    sections = data.sections;

    document.getElementById('rubricShortTitle').textContent = (data.shortTitle || data.title || 'Proyecto de Integración Mecatrónica').toUpperCase();
    document.getElementById('rubricDescription').textContent = data.description || '';
    document.getElementById('rubricInstructions').textContent = data.instructions || '';
    document.getElementById('rubricVersion').textContent = `Rúbrica v${data.version || '—'} · ${totalBaseItems()} criterios · ${formatNumber(totalBaseWeight())} pt base`;

    renderRubric();
    loadState();
    updateScore();
    loadingMessage.remove();
  } catch (error) {
    console.error(error);
    loadingMessage.classList.add('loading-panel--error');
    loadingMessage.innerHTML = `<strong>No fue posible cargar la rúbrica.</strong><br>${escapeHtml(error.message)}<br><small>Si abriste index.html directamente desde el disco, ejecuta un servidor local o publícalo en GitHub Pages para permitir la carga de rubric.json.</small>`;
  }
}

init();
