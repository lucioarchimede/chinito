const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/notes
router.get('/', async (req, res) => {
  try {
    const { category, pinned, q } = req.query;
    let conditions = [];
    let params = [];
    let idx = 1;

    if (category) { conditions.push(`category = $${idx++}`); params.push(category); }
    if (pinned !== undefined) { conditions.push(`is_pinned = $${idx++}`); params.push(pinned === 'true'); }
    if (q) { conditions.push(`(title ILIKE $${idx} OR content ILIKE $${idx})`); params.push(`%${q}%`); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT * FROM notes ${where} ORDER BY is_pinned DESC, updated_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[notes/GET]', err);
    res.status(500).json({ error: 'Error al obtener notas' });
  }
});

// GET /api/notes/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM notes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/notes
router.post('/', async (req, res) => {
  try {
    const { title, content, category, tags, is_pinned } = req.body;
    if (!title) return res.status(400).json({ error: 'El título es requerido' });
    const result = await db.query(
      `INSERT INTO notes (title, content, category, tags, is_pinned)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, content || null, category || null, tags || null, is_pinned || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[notes/POST]', err);
    res.status(500).json({ error: 'Error al crear nota' });
  }
});

// PUT /api/notes/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, content, category, tags, is_pinned } = req.body;
    const result = await db.query(
      `UPDATE notes SET title=$1, content=$2, category=$3, tags=$4, is_pinned=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [title, content || null, category || null, tags || null, is_pinned || false, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar nota' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM notes WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json({ message: 'Nota eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
