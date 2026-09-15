const express = require('express');
const path = require('path');
const dns = require('dns');
const { Pool } = require('pg');

dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 3000;
if (!process.env.DATABASE_URL) console.warn('ADVERTENCIA: falta DATABASE_URL. Configurala en el servidor online.');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS noticias (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      link TEXT NOT NULL,
      descripcion TEXT NOT NULL DEFAULT '',
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cargado_por TEXT NOT NULL DEFAULT 'Sin especificar',
      grabada_editada BOOLEAN NOT NULL DEFAULT FALSE,
      hecho BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS guiones (
      id SERIAL PRIMARY KEY,
      noticia_id INTEGER NOT NULL REFERENCES noticias(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      contenido TEXT NOT NULL,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cargado_por TEXT NOT NULL DEFAULT 'Sin especificar',
      grabada_editada BOOLEAN NOT NULL DEFAULT FALSE,
      hecho BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS idx_guiones_noticia ON guiones(noticia_id);

    ALTER TABLE noticias ADD COLUMN IF NOT EXISTS cargado_por TEXT NOT NULL DEFAULT 'Sin especificar';
    ALTER TABLE noticias ADD COLUMN IF NOT EXISTS grabada_editada BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE noticias ADD COLUMN IF NOT EXISTS hecho BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE guiones ADD COLUMN IF NOT EXISTS cargado_por TEXT NOT NULL DEFAULT 'Sin especificar';
    ALTER TABLE guiones ADD COLUMN IF NOT EXISTS grabada_editada BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE guiones ADD COLUMN IF NOT EXISTS hecho BOOLEAN NOT NULL DEFAULT FALSE;
  `);
  await cleanupOldContent();
}

async function cleanupOldContent() {
  try {
    // El contenido vence 7 días después de su fecha original de carga.
    // Al eliminar una noticia, PostgreSQL elimina sus guiones por ON DELETE CASCADE.
    const result = await pool.query(`DELETE FROM noticias WHERE fecha_creacion < NOW() - INTERVAL '7 days'`);
    if (result.rowCount) console.log(`Limpieza automática: ${result.rowCount} noticia(s) eliminada(s) por antigüedad.`);
    const scripts = await pool.query(`DELETE FROM guiones WHERE fecha_creacion < NOW() - INTERVAL '7 days'`);
    if (scripts.rowCount) console.log(`Limpieza automática: ${scripts.rowCount} guion(es) eliminado(s) por antigüedad.`);
  } catch (err) {
    console.error('No se pudo ejecutar la limpieza automática:', err.message);
  }
}

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch (e) { res.status(503).json({ ok: false, error: 'Base de datos no disponible.' }); }
});

app.get('/api/noticias', async (req, res, next) => {
  try {
    await cleanupOldContent();
    const { rows } = await pool.query(`
      SELECT n.*, COUNT(g.id)::int AS cantidad_guiones
      FROM noticias n
      LEFT JOIN guiones g ON g.noticia_id=n.id
      GROUP BY n.id
      ORDER BY n.id DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

app.post('/api/noticias', async (req, res, next) => {
  try {
    const { titulo, link, descripcion = '', cargado_por } = req.body;
    if (!titulo?.trim() || !link?.trim() || !cargado_por?.trim()) {
      return res.status(400).json({ error: 'Título, link y nombre de quien carga son obligatorios.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO noticias (titulo,link,descripcion,cargado_por) VALUES ($1,$2,$3,$4) RETURNING *`,
      [titulo.trim(), link.trim(), String(descripcion).trim(), cargado_por.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

app.put('/api/noticias/:id', async (req, res, next) => {
  try {
    const { titulo, link, descripcion = '' } = req.body;
    if (!titulo?.trim() || !link?.trim()) return res.status(400).json({ error: 'Título y link son obligatorios.' });
    const { rows } = await pool.query(
      `UPDATE noticias SET titulo=$1,link=$2,descripcion=$3 WHERE id=$4 RETURNING *`,
      [titulo.trim(), link.trim(), String(descripcion).trim(), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Noticia no encontrada.' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

app.patch('/api/noticias/:id/estado', async (req, res, next) => {
  try {
    const allowed = ['grabada_editada', 'hecho'];
    const campo = req.body.campo;
    if (!allowed.includes(campo) || typeof req.body.valor !== 'boolean') {
      return res.status(400).json({ error: 'Estado inválido.' });
    }
    const { rows } = await pool.query(`UPDATE noticias SET ${campo}=$1 WHERE id=$2 RETURNING *`, [req.body.valor, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Noticia no encontrada.' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

app.delete('/api/noticias/:id', async (req, res, next) => {
  try {
    const r = await pool.query('DELETE FROM noticias WHERE id=$1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Noticia no encontrada.' });
    res.status(204).end();
  } catch (e) { next(e); }
});

app.get('/api/guiones', async (req, res, next) => {
  try {
    await cleanupOldContent();
    const { rows } = await pool.query(`
      SELECT g.*, n.titulo AS noticia_titulo, n.link AS noticia_link
      FROM guiones g JOIN noticias n ON n.id=g.noticia_id
      ORDER BY g.id DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

app.post('/api/guiones', async (req, res, next) => {
  try {
    const { noticia_id, titulo, contenido, cargado_por } = req.body;
    if (!noticia_id || !titulo?.trim() || contenido === undefined || !cargado_por?.trim()) {
      return res.status(400).json({ error: 'Noticia, título, contenido y nombre de quien carga son obligatorios.' });
    }
    const noticia = await pool.query('SELECT id FROM noticias WHERE id=$1', [noticia_id]);
    if (!noticia.rowCount) return res.status(400).json({ error: 'Primero debe existir la noticia seleccionada.' });
    const { rows } = await pool.query(
      `INSERT INTO guiones (noticia_id,titulo,contenido,cargado_por) VALUES ($1,$2,$3,$4) RETURNING *`,
      [noticia_id, titulo.trim(), String(contenido), cargado_por.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

app.put('/api/guiones/:id', async (req, res, next) => {
  try {
    const { noticia_id, titulo, contenido } = req.body;
    if (!noticia_id || !titulo?.trim() || contenido === undefined) return res.status(400).json({ error: 'Noticia, título y contenido son obligatorios.' });
    const noticia = await pool.query('SELECT id FROM noticias WHERE id=$1', [noticia_id]);
    if (!noticia.rowCount) return res.status(400).json({ error: 'La noticia no existe.' });
    const { rows } = await pool.query(
      `UPDATE guiones SET noticia_id=$1,titulo=$2,contenido=$3,fecha_actualizacion=NOW() WHERE id=$4 RETURNING *`,
      [noticia_id, titulo.trim(), String(contenido), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Guion no encontrado.' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

app.patch('/api/guiones/:id/estado', async (req, res, next) => {
  try {
    const allowed = ['grabada_editada', 'hecho'];
    const campo = req.body.campo;
    if (!allowed.includes(campo) || typeof req.body.valor !== 'boolean') {
      return res.status(400).json({ error: 'Estado inválido.' });
    }
    const { rows } = await pool.query(`UPDATE guiones SET ${campo}=$1,fecha_actualizacion=NOW() WHERE id=$2 RETURNING *`, [req.body.valor, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Guion no encontrado.' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

app.delete('/api/guiones/:id', async (req, res, next) => {
  try {
    const r = await pool.query('DELETE FROM guiones WHERE id=$1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Guion no encontrado.' });
    res.status(204).end();
  } catch (e) { next(e); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Error interno del servidor.' }); });

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
  try {
    await initDb();
    console.log('Base de datos inicializada correctamente.');
    setInterval(cleanupOldContent, 60 * 60 * 1000);
  } catch (err) {
    console.error('ADVERTENCIA: no se pudo inicializar la base de datos. La web sigue disponible, pero las operaciones de Noticias/Guiones fallarán hasta corregir DATABASE_URL.');
    console.error(err.message);
  }
});

process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught exception:', err));
