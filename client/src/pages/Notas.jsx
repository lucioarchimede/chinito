import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Pin, FileText, AlertTriangle, Search } from 'lucide-react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input, { Textarea } from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { formatDate } from '../utils/formatters';

const EMPTY = { title: '', content: '', category: '', tags: '', is_pinned: false };
const CATEGORIES = ['estrategia', 'proveedores', 'ideas', 'operaciones', 'finanzas', 'clientes', 'otro'];
const catColor = (c) => ({ estrategia:'indigo', proveedores:'blue', ideas:'purple', operaciones:'orange', finanzas:'green', clientes:'yellow', otro:'gray' }[c] || 'gray');

export default function Notas() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewNote, setViewNote] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ q: '', category: '' });

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.category) params.set('category', filters.category);
      const res = await api.get(`/notes?${params}`);
      setNotes(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModalOpen(true); };
  const openEdit = (n) => {
    setForm({
      title: n.title, content: n.content || '', category: n.category || '',
      tags: Array.isArray(n.tags) ? n.tags.join(', ') : (n.tags || ''),
      is_pinned: n.is_pinned || false
    });
    setEditId(n.id); setViewNote(null); setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : null
      };
      if (editId) await api.put(`/notes/${editId}`, payload);
      else await api.post('/notes', payload);
      setModalOpen(false); fetchNotes();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/notes/${deleteId}`); setDeleteId(null); setViewNote(null); fetchNotes(); }
    catch { alert('Error al eliminar'); }
  };

  const togglePin = async (note) => {
    try {
      await api.put(`/notes/${note.id}`, { ...note, is_pinned: !note.is_pinned, tags: note.tags });
      fetchNotes();
    } catch { }
  };

  const ff = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const pinned = notes.filter(n => n.is_pinned);
  const unpinned = notes.filter(n => !n.is_pinned);

  const NoteCard = ({ note }) => (
    <div
      onClick={() => setViewNote(note)}
      className={`rounded-xl border shadow-card p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 relative
        ${note.is_pinned
          ? 'border-indigo-200 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug">{note.title}</h3>
        {note.is_pinned && <Pin size={12} className="text-indigo-500 flex-shrink-0 mt-0.5" />}
      </div>
      {note.content && (
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mb-2.5 whitespace-pre-wrap leading-relaxed">{note.content}</p>
      )}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex gap-1.5 flex-wrap">
          {note.category && <Badge variant={catColor(note.category)}>{note.category}</Badge>}
          {Array.isArray(note.tags) && note.tags.slice(0, 2).map(t => (
            <span key={t} className="text-xs text-slate-400 dark:text-slate-500">#{t}</span>
          ))}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">{formatDate(note.updated_at)}</span>
      </div>
    </div>
  );

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="flex-1 min-w-40 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Buscar notas..." value={filters.q}
            onChange={e => setFilters(p => ({ ...p, q: e.target.value }))}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 min-h-[42px]" />
        </div>
        <select value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors text-slate-900 dark:text-slate-100 min-h-[42px]">
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <Button icon={Plus} onClick={openCreate}>Nueva Nota</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
              <div className="space-y-1.5 mb-4">
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
              </div>
              <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded w-16" />
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <FileText size={36} className="mb-2.5" />
          <p className="text-sm">No hay notas. ¡Crea la primera!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Pin size={11} /> Fijadas
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinned.map(n => <NoteCard key={n.id} note={n} />)}
              </div>
            </div>
          )}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Otras notas</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unpinned.map(n => <NoteCard key={n.id} note={n} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal ver nota */}
      {viewNote && (
        <Modal isOpen={true} onClose={() => setViewNote(null)} title={viewNote.title} size="md">
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {viewNote.category && <Badge variant={catColor(viewNote.category)}>{viewNote.category}</Badge>}
              {Array.isArray(viewNote.tags) && viewNote.tags.map(t => (
                <span key={t} className="text-xs text-slate-400 dark:text-slate-500">#{t}</span>
              ))}
            </div>
            {viewNote.content && (
              <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed bg-slate-50 dark:bg-slate-800 rounded-xl p-4 max-h-80 overflow-y-auto scrollbar-thin">
                {viewNote.content}
              </pre>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500">Actualizado: {formatDate(viewNote.updated_at)}</p>
            <div className="flex justify-between pt-2">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" icon={Pin} onClick={() => { togglePin(viewNote); setViewNote(null); }}>
                  {viewNote.is_pinned ? 'Desfijar' : 'Fijar'}
                </Button>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => { setDeleteId(viewNote.id); setViewNote(null); }}>
                  Eliminar
                </Button>
              </div>
              <Button size="sm" icon={Edit2} onClick={() => openEdit(viewNote)}>Editar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal crear/editar */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar Nota' : 'Nueva Nota'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Título *" value={form.title} onChange={ff('title')} required placeholder="Título de la nota" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Categoría" value={form.category} onChange={ff('category')}>
              <option value="">Sin categoría</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </Select>
            <Input label="Tags (separados por coma)" value={form.tags} onChange={ff('tags')} placeholder="tag1, tag2" />
          </div>
          <Textarea label="Contenido" value={form.content} onChange={ff('content')}
            rows={8} placeholder="Escribe el contenido de la nota aquí..." />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="pinned" checked={form.is_pinned}
              onChange={e => setForm(p => ({ ...p, is_pinned: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600" />
            <label htmlFor="pinned" className="text-sm text-slate-700 dark:text-slate-300">Fijar nota</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Nota" size="sm">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 dark:text-slate-300">¿Eliminar esta nota? Esta acción no se puede deshacer.</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
