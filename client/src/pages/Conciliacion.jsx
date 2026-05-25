import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Upload, CheckCircle, XCircle, Link2, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useChartTheme } from '../context/ThemeContext';

const CSV_TEMPLATE = `fecha,descripcion,monto,tipo,referencia
2024-01-15,Pago MercadoPago,1250.00,credito,MP-123456
2024-01-16,Transferencia,850.00,credito,TRF-789
2024-01-17,Comision bancaria,-45.00,debito,COM-001`;

function MatchModal({ movement, onMatch, onClose, matching }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  const search = async (q) => {
    setSearching(true);
    try {
      const res = await api.get('/reconciliation/sales-search', {
        params: { q, amount: movement.amount, date: movement.transaction_date }
      });
      setResults(res.data);
    } catch { }
    finally { setSearching(false); }
  };

  useEffect(() => { search(''); }, []);

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">Movimiento a conciliar</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 mt-0.5">{movement.description || '(sin descripción)'}</p>
        <p className="text-sm text-indigo-600 dark:text-indigo-400 font-bold">{formatCurrency(movement.amount)} · {formatDate(movement.transaction_date)}</p>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Buscar por cliente..." value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(query)} />
        <Button onClick={() => search(query)} disabled={searching}>
          <Search size={14} />
        </Button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {searching ? (
          <div className="text-center py-4 text-slate-400 text-sm">Buscando...</div>
        ) : results.length === 0 ? (
          <div className="text-center py-4 text-slate-400 text-sm">Sin resultados</div>
        ) : results.map(sale => (
          <div
            key={sale.id}
            onClick={() => setSelectedSale(sale)}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors touch-manipulation ${selectedSale?.id === sale.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{sale.customer_name || 'Sin nombre'}</p>
              <p className="text-xs text-slate-400">{formatDate(sale.sale_date)} · {sale.sale_channel}</p>
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex-shrink-0">{formatCurrency(sale.final_revenue)}</p>
            {selectedSale?.id === sale.id && <CheckCircle size={16} className="text-indigo-500 flex-shrink-0" />}
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <Button onClick={() => selectedSale && onMatch(movement.id, selectedSale.id)} disabled={!selectedSale || matching}>
          {matching ? 'Conciliando...' : 'Conciliar'}
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
}

export default function Conciliacion() {
  const [summary, setSummary] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [matchModal, setMatchModal] = useState(null);
  const [matching, setMatching] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const fileRef = useRef(null);
  const chart = useChartTheme();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, movRes] = await Promise.all([
        api.get('/reconciliation/summary'),
        api.get('/reconciliation/movements', { params: { status: tab, limit: 100 } }),
      ]);
      setSummary(sumRes.data);
      setMovements(movRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [tab]);

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await api.post('/reconciliation/import', text, {
        headers: { 'Content-Type': 'text/plain' }
      });
      setImportResult(res.data);
      fetchData();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Error al importar' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const res = await api.post('/reconciliation/auto-match', {});
      alert(`Auto-conciliación completada: ${res.data.matched} movimientos conciliados`);
      fetchData();
    } catch { alert('Error en auto-conciliación'); }
    finally { setAutoMatching(false); }
  };

  const handleMatch = async (movementId, saleId) => {
    setMatching(true);
    try {
      await api.post('/reconciliation/match', { movement_id: movementId, sale_id: saleId });
      setMatchModal(null);
      fetchData();
    } catch { alert('Error al conciliar'); }
    finally { setMatching(false); }
  };

  const handleIgnore = async (id) => {
    try {
      await api.put(`/reconciliation/${id}/ignore`);
      fetchData();
    } catch { alert('Error'); }
  };

  const handleUnmatch = async (id) => {
    try {
      await api.put(`/reconciliation/${id}/unmatch`);
      fetchData();
    } catch { alert('Error'); }
  };

  const chartData = summary ? [
    { name: 'Pendientes', value: parseInt(summary.pending), fill: '#f59e0b' },
    { name: 'Conciliados', value: parseInt(summary.matched), fill: '#10b981' },
    { name: 'Ignorados', value: parseInt(summary.ignored), fill: '#94a3b8' },
  ] : [];

  const tabs = [
    { id: 'pending', label: `Pendientes (${summary?.pending || 0})` },
    { id: 'matched', label: `Conciliados (${summary?.matched || 0})` },
    { id: 'ignored', label: 'Ignorados' },
  ];

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {loading && !summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total movimientos', value: summary.total, color: 'text-slate-900 dark:text-slate-50' },
            { label: 'Pendientes', value: summary.pending, color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Conciliados', value: summary.matched, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Créditos conciliados', value: formatCurrency(summary.matched_credits), color: 'text-indigo-600 dark:text-indigo-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
              <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions + Import */}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl cursor-pointer transition-colors touch-manipulation ${importing ? 'opacity-70 pointer-events-none' : ''}`}>
          <Upload size={14} />
          {importing ? 'Importando...' : 'Importar CSV'}
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileImport} />
        </label>
        <Button variant="ghost" onClick={() => setShowTemplate(!showTemplate)} className="text-sm">
          {showTemplate ? 'Ocultar' : 'Ver'} plantilla CSV
        </Button>
        <Button onClick={handleAutoMatch} disabled={autoMatching} variant="ghost"
          className="flex items-center gap-2 text-sm">
          <RefreshCw size={14} className={autoMatching ? 'animate-spin' : ''} />
          Auto-conciliar
        </Button>
      </div>

      {importResult && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${importResult.error ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'}`}>
          {importResult.error || `Importados: ${importResult.imported} · Omitidos: ${importResult.skipped} · Total: ${importResult.total}`}
        </div>
      )}

      {showTemplate && (
        <div className="bg-slate-900 dark:bg-black rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-2">Formato CSV esperado:</p>
          <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">{CSV_TEMPLATE}</pre>
        </div>
      )}

      {/* Chart */}
      {summary && parseInt(summary.total) > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Estado de Movimientos</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="name" tick={chart.tick} />
              <YAxis tick={chart.tick} allowDecimals={false} />
              <Tooltip contentStyle={chart.tooltipStyle} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-card">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors touch-manipulation ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Movements table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 mx-4 my-3" />)}
          </div>
        ) : movements.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle size={32} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {tab === 'pending' ? 'No hay movimientos pendientes' : tab === 'matched' ? 'No hay movimientos conciliados' : 'No hay movimientos ignorados'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Descripción</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Monto</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Tipo</th>
                  {tab === 'matched' && <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 hidden sm:table-cell">Venta asignada</th>}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(m.transaction_date)}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">{m.description || '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${m.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {m.type === 'credit' ? '+' : '-'}{formatCurrency(m.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={m.type === 'credit' ? 'green' : 'red'} className="text-xs">
                        {m.type === 'credit' ? 'Crédito' : 'Débito'}
                      </Badge>
                    </td>
                    {tab === 'matched' && (
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs hidden sm:table-cell">
                        {m.customer_name ? `${m.customer_name} · ${formatCurrency(m.sale_revenue)}` : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {tab === 'pending' && (
                          <>
                            <button onClick={() => setMatchModal(m)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors touch-manipulation"
                              title="Conciliar manualmente">
                              <Link2 size={14} />
                            </button>
                            <button onClick={() => handleIgnore(m.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors touch-manipulation"
                              title="Ignorar">
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                        {(tab === 'matched' || tab === 'ignored') && (
                          <button onClick={() => handleUnmatch(m.id)}
                            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors touch-manipulation">
                            Deshacer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Match modal */}
      {matchModal && (
        <Modal isOpen={!!matchModal} onClose={() => setMatchModal(null)} title="Conciliar Movimiento" size="lg">
          <MatchModal
            movement={matchModal}
            onMatch={handleMatch}
            onClose={() => setMatchModal(null)}
            matching={matching}
          />
        </Modal>
      )}
    </div>
  );
}
