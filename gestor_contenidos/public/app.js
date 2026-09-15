const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
let noticias = [], guiones = [];

async function api(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) { let e = {}; try { e = await r.json(); } catch {} throw Error(e.error || 'Error inesperado'); }
  return r.status === 204 ? null : r.json();
}

function toast(t) {
  const x = $('#toast'); x.textContent = t; x.style.display = 'block';
  clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => x.style.display = 'none', 2800);
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires'
  }).format(d);
}

function statusButton(id, tipo, value) {
  const labels = { grabada_editada: 'Grabada / editada', hecho: 'Hecho' };
  return `<button class="status-toggle ${value ? 'on' : 'off'}" title="Cambiar estado" onclick="toggleStatus('${tipo}', ${id}, '${tipo === 'news' ? 'grabada_editada' : 'grabada_editada'}')">
    <span class="status-light"></span><span>${labels.grabada_editada}</span><strong>${value ? 'SÍ' : 'NO'}</strong>
  </button>`;
}

function doneButton(id, tipo, value) {
  return `<button class="status-toggle ${value ? 'on' : 'off'}" title="Cambiar estado" onclick="toggleStatus('${tipo}', ${id}, 'hecho')">
    <span class="status-light"></span><span>Hecho</span><strong>${value ? 'SÍ' : 'NO'}</strong>
  </button>`;
}

function renderNews() {
  $('#newsCount').textContent = `${noticias.length} noticia${noticias.length === 1 ? '' : 's'}`;
  $('#newsList').innerHTML = noticias.length ? noticias.map(n => `
    <article class="card">
      <span class="badge">${n.cantidad_guiones} guion${n.cantidad_guiones === 1 ? '' : 'es'}</span>
      <h3>${escapeHtml(n.titulo)}</h3>
      <a class="source" href="${escapeHtml(n.link)}" target="_blank" rel="noopener">${escapeHtml(n.link)}</a>
      <div class="desc">${escapeHtml(n.descripcion)}</div>
      <div class="info-grid">
        <div><span class="info-label">Cargada por</span><strong>${escapeHtml(n.cargado_por)}</strong></div>
        <div><span class="info-label">Fecha y hora</span><strong>${formatDate(n.fecha_creacion)}</strong></div>
      </div>
      <div class="statuses">
        ${statusButton(n.id, 'news', n.grabada_editada)}
        ${doneButton(n.id, 'news', n.hecho)}
      </div>
      <div class="actions"><button class="secondary" onclick="editNews(${n.id})">Editar</button><button class="danger" onclick="deleteNews(${n.id})">Eliminar</button></div>
    </article>`).join('') : `<div class="empty">Todavía no hay noticias. Creá la primera para habilitar los guiones.</div>`;
  fillNewsSelect();
}

function renderScripts() {
  $('#scriptCount').textContent = `${guiones.length} guion${guiones.length === 1 ? '' : 'es'}`;
  $('#scriptList').innerHTML = guiones.length ? guiones.map(g => `
    <article class="script-card">
      <span class="badge">Noticia: ${escapeHtml(g.noticia_titulo)}</span>
      <h3>${escapeHtml(g.titulo)}</h3>
      <div class="content">${escapeHtml(g.contenido)}</div>
      <div class="info-grid">
        <div><span class="info-label">Cargado por</span><strong>${escapeHtml(g.cargado_por)}</strong></div>
        <div><span class="info-label">Fecha y hora de carga</span><strong>${formatDate(g.fecha_creacion)}</strong></div>
      </div>
      <div class="meta">Última actualización: ${formatDate(g.fecha_actualizacion)}</div>
      <div class="statuses">
        ${statusButton(g.id, 'script', g.grabada_editada)}
        ${doneButton(g.id, 'script', g.hecho)}
      </div>
      <div class="actions"><button class="secondary" onclick="editScript(${g.id})">Editar</button><button class="danger" onclick="deleteScript(${g.id})">Eliminar</button></div>
    </article>`).join('') : `<div class="empty">No hay guiones cargados.</div>`;
}

function fillNewsSelect(selected) {
  const s = $('#scriptNews');
  s.innerHTML = '<option value="">Seleccioná una noticia...</option>' + noticias.map(n => `<option value="${n.id}">${escapeHtml(n.titulo)}</option>`).join('');
  if (selected) s.value = selected;
}

async function load() {
  [noticias, guiones] = await Promise.all([api('/api/noticias'), api('/api/guiones')]);
  renderNews(); renderScripts();
}

$('#newNews').onclick = () => {
  $('#newsFormTitle').textContent = 'Nueva noticia'; $('#newsId').value = '';
  $('#newsTitle').value = ''; $('#newsLink').value = ''; $('#newsDesc').value = ''; $('#newsPerson').value = '';
  $('#newsForm').classList.remove('hidden'); $('#newsPerson').focus();
};
$('#cancelNews').onclick = () => $('#newsForm').classList.add('hidden');

$('#newsForm form').onsubmit = async e => {
  e.preventDefault();
  const id = $('#newsId').value;
  const body = { titulo: $('#newsTitle').value, link: $('#newsLink').value, descripcion: $('#newsDesc').value, cargado_por: $('#newsPerson').value };
  try {
    await api(id ? `/api/noticias/${id}` : '/api/noticias', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    $('#newsForm').classList.add('hidden'); toast('Noticia guardada'); await load();
  } catch (e) { toast(e.message); }
};

window.editNews = id => {
  const n = noticias.find(x => x.id === id); if (!n) return;
  $('#newsFormTitle').textContent = 'Editar noticia'; $('#newsId').value = n.id;
  $('#newsTitle').value = n.titulo; $('#newsLink').value = n.link; $('#newsDesc').value = n.descripcion;
  $('#newsPerson').value = n.cargado_por || '';
  $('#newsForm').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteNews = async id => {
  if (confirm('¿Eliminar esta noticia? También se eliminarán sus guiones.')) {
    try { await api('/api/noticias/' + id, { method: 'DELETE' }); toast('Noticia eliminada'); await load(); }
    catch (e) { toast(e.message); }
  }
};

$('#newScript').onclick = () => {
  if (!noticias.length) return toast('Primero tenés que cargar una noticia.');
  $('#scriptFormTitle').textContent = 'Nuevo guion'; $('#scriptId').value = '';
  fillNewsSelect(); $('#scriptTitle').value = ''; $('#scriptContent').value = ''; $('#scriptPerson').value = '';
  $('#scriptForm').classList.remove('hidden'); $('#scriptPerson').focus();
};
$('#cancelScript').onclick = () => $('#scriptForm').classList.add('hidden');

$('#scriptForm form').onsubmit = async e => {
  e.preventDefault();
  const id = $('#scriptId').value;
  const body = { noticia_id: Number($('#scriptNews').value), titulo: $('#scriptTitle').value, contenido: $('#scriptContent').value, cargado_por: $('#scriptPerson').value };
  try {
    await api(id ? `/api/guiones/${id}` : '/api/guiones', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    $('#scriptForm').classList.add('hidden'); toast('Guion guardado'); await load();
  } catch (e) { toast(e.message); }
};

window.editScript = id => {
  const g = guiones.find(x => x.id === id); if (!g) return;
  $('#scriptFormTitle').textContent = 'Editar guion'; $('#scriptId').value = g.id;
  fillNewsSelect(g.noticia_id); $('#scriptTitle').value = g.titulo; $('#scriptContent').value = g.contenido;
  $('#scriptPerson').value = g.cargado_por || '';
  $('#scriptForm').classList.remove('hidden'); document.querySelector('[data-tab="guiones"]').click(); window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteScript = async id => {
  if (confirm('¿Eliminar este guion?')) {
    try { await api('/api/guiones/' + id, { method: 'DELETE' }); toast('Guion eliminado'); await load(); }
    catch (e) { toast(e.message); }
  }
};

window.toggleStatus = async (tipo, id, campo) => {
  const lista = tipo === 'news' ? noticias : guiones;
  const item = lista.find(x => x.id === id); if (!item) return;
  const nuevoValor = !Boolean(item[campo]);
  try {
    const actualizado = await api(`/api/${tipo === 'news' ? 'noticias' : 'guiones'}/${id}/estado`, {
      method: 'PATCH', body: JSON.stringify({ campo, valor: nuevoValor })
    });
    Object.assign(item, actualizado);
    tipo === 'news' ? renderNews() : renderScripts();
    toast(nuevoValor ? 'Estado marcado como SÍ' : 'Estado marcado como NO');
  } catch (e) { toast(e.message); }
};

$$('.tab').forEach(b => b.onclick = () => {
  $$('.tab').forEach(x => x.classList.remove('active')); $$('.panel').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); $('#' + b.dataset.tab).classList.add('active');
});

load().catch(e => toast(e.message));
