import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle, XCircle, RefreshCw, Link2, Link2Off,
  Clock, AlertTriangle, ExternalLink, Zap,
} from 'lucide-react';
import api from '../utils/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

// ── Platform metadata ─────────────────────────────────────────────────────────

const PLATFORM_INFO = {
  tiendanube: {
    name: 'Tienda Nube',
    color: 'bg-blue-500',
    logo: '☁️',
    authType: 'oauth', // redirects to Tiendanube OAuth
    description: 'Sincroniza productos, órdenes y stock con tu tienda TiendaNube.',
  },
  shopify: {
    name: 'Shopify',
    color: 'bg-green-600',
    logo: '🛍️',
    authType: 'oauth', // redirects to Shopify OAuth (requires shop domain input)
    description: 'Conecta con tu tienda Shopify y mantén todo sincronizado en tiempo real.',
  },
  mercadolibre: {
    name: 'Mercado Libre',
    color: 'bg-yellow-400',
    logo: '🛒',
    authType: 'manual',
    description: 'Sincroniza ventas de Mercado Libre directamente en tu dashboard.',
    fields: [
      { key: 'seller_id', label: 'Seller ID', placeholder: 'ej: 123456789' },
      { key: 'access_token', label: 'Access Token', placeholder: 'APP_USR-...', type: 'password' },
      { key: 'refresh_token', label: 'Refresh Token', placeholder: 'TG-...', type: 'password' },
    ],
  },
};

const STATUS_INFO = {
  idle:     { label: 'Inactivo',       color: 'gray',  icon: Clock },
  syncing:  { label: 'Sincronizando',  color: 'blue',  icon: RefreshCw },
  success:  { label: 'Sincronizado',   color: 'green', icon: CheckCircle },
  error:    { label: 'Error',          color: 'red',   icon: AlertTriangle },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ShopifyConnectModal({ onConnect, onClose }) {
  const [shop, setShop] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!shop.trim()) return;
    setLoading(true);
    try {
      // Normalize: strip protocol if user pasted a full URL
      const domain = shop.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      await onConnect(domain);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleConnect} className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl mb-2">
        <span className="text-2xl">🛍️</span>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Conectar con Shopify</p>
          <p className="text-xs text-slate-400">Serás redirigido a Shopify para autorizar el acceso.</p>
        </div>
      </div>
      <Input
        label="Dominio de tu tienda"
        placeholder="mi-tienda.myshopify.com"
        value={shop}
        onChange={(e) => setShop(e.target.value)}
        required
      />
      <p className="text-xs text-slate-400">
        Solo el dominio, sin https:// — ej: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">mi-tienda.myshopify.com</code>
      </p>
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading} className="flex items-center gap-2">
          <ExternalLink size={14} />
          {loading ? 'Redirigiendo...' : 'Conectar con Shopify'}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

function ManualConnectModal({ platform, info, onConnect, onClose, connecting }) {
  const [credentials, setCredentials] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    onConnect(credentials);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
        <span className="text-2xl">{info.logo}</span>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{info.name}</p>
          <p className="text-xs text-slate-400">Conecta tu cuenta para sincronizar productos y pedidos</p>
        </div>
      </div>
      {(info.fields || []).map((field) => (
        <Input
          key={field.key}
          label={field.label}
          type={field.type || 'text'}
          placeholder={field.placeholder}
          value={credentials[field.key] || ''}
          onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))}
          required
        />
      ))}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={connecting}>{connecting ? 'Conectando...' : 'Guardar'}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

function LogsModal({ logs, onClose }) {
  return (
    <div>
      {logs.length === 0 ? (
        <p className="text-slate-400 text-sm py-4 text-center">Sin registros de sincronización</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
          {logs.map((log) => {
            const st = STATUS_INFO[log.status] || STATUS_INFO.idle;
            const Icon = st.icon;
            return (
              <div key={log.id} className="flex items-start gap-3 py-3">
                <Icon
                  size={14}
                  className={`mt-0.5 flex-shrink-0 ${
                    log.status === 'success' ? 'text-emerald-500'
                    : log.status === 'error' ? 'text-red-500'
                    : 'text-slate-400'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={st.color} className="text-xs">{log.sync_type}</Badge>
                    <Badge
                      variant={log.status === 'success' ? 'green' : log.status === 'error' ? 'red' : 'gray'}
                      className="text-xs"
                    >
                      {st.label}
                    </Badge>
                    {log.records_synced > 0 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {log.records_synced} registros
                      </span>
                    )}
                  </div>
                  {log.error_message && (
                    <p className="text-xs text-red-500 mt-1 break-words">{log.error_message}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(log.started_at || log.created_at).toLocaleString('es-AR')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}

// ── Sync type selector ────────────────────────────────────────────────────────

function SyncMenu({ platform, onSync, disabled }) {
  const [open, setOpen] = useState(false);
  const options = [
    { key: 'full',     label: 'Sincronización completa' },
    { key: 'products', label: 'Solo productos' },
    { key: 'orders',   label: 'Solo pedidos' },
    { key: 'stock',    label: 'Enviar stock a plataforma' },
  ];
  return (
    <div className="relative">
      <Button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2"
      >
        <RefreshCw size={14} className={disabled ? 'animate-spin' : ''} />
        {disabled ? 'Sincronizando...' : 'Sincronizar'}
      </Button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setOpen(false); onSync(platform, opt.key); }}
              className="w-full text-left text-sm px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Integraciones() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectModal, setConnectModal] = useState(null); // platform key
  const [logsModal, setLogsModal] = useState(null);
  const [logs, setLogs] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState({});
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message }

  // Handle OAuth redirect results (?connected=platform or ?error=...)
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      showToast('success', `¡${PLATFORM_INFO[connected]?.name || connected} conectado correctamente!`);
      setSearchParams({});
    } else if (error) {
      const msgs = {
        invalid_state: 'El enlace de autorización expiró. Intentá de nuevo.',
        hmac_invalid: 'Firma inválida en la respuesta de Shopify.',
        oauth_failed: 'Error al completar la autorización. Verificá las credenciales de la app.',
        not_configured: 'Las variables de entorno de la integración no están configuradas en el servidor.',
        missing_params: 'Parámetros faltantes en la respuesta OAuth.',
      };
      showToast('error', msgs[error] || `Error de autorización: ${error}`);
      setSearchParams({});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/integrations');
      setIntegrations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIntegrations(); }, []);

  // ── OAuth connect ───────────────────────────────────────────────────────────

  const startOAuth = async (platform, shopDomain = null) => {
    try {
      const params = shopDomain ? `?shop=${encodeURIComponent(shopDomain)}` : '';
      const res = await api.get(`/integrations/${platform}/auth${params}`);
      // Redirect the user's browser to the OAuth authorization page
      window.location.href = res.data.authUrl;
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al iniciar la autorización';
      showToast('error', msg);
    }
  };

  // ── Manual connect (MercadoLibre) ───────────────────────────────────────────

  const handleManualConnect = async (credentials) => {
    setConnecting(true);
    try {
      await api.put(`/integrations/${connectModal}/connect`, { credentials });
      setConnectModal(null);
      fetchIntegrations();
      showToast('success', `${PLATFORM_INFO[connectModal]?.name} conectado.`);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Error al conectar');
    } finally {
      setConnecting(false);
    }
  };

  // ── Disconnect ──────────────────────────────────────────────────────────────

  const handleDisconnect = async (platform) => {
    if (!confirm(`¿Desconectar ${PLATFORM_INFO[platform]?.name || platform}? Se eliminarán las credenciales guardadas.`)) return;
    try {
      await api.put(`/integrations/${platform}/disconnect`);
      fetchIntegrations();
      showToast('success', `${PLATFORM_INFO[platform]?.name} desconectado.`);
    } catch {
      showToast('error', 'Error al desconectar');
    }
  };

  // ── Sync ────────────────────────────────────────────────────────────────────

  const handleSync = async (platform, syncType = 'full') => {
    setSyncing((s) => ({ ...s, [platform]: true }));
    try {
      await api.post(`/integrations/${platform}/sync`, { sync_type: syncType });
      // Poll for completion — check once after 4 s
      setTimeout(() => {
        fetchIntegrations();
        setSyncing((s) => ({ ...s, [platform]: false }));
      }, 4000);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Error al sincronizar');
      setSyncing((s) => ({ ...s, [platform]: false }));
    }
  };

  // ── Logs ────────────────────────────────────────────────────────────────────

  const openLogs = async (platform) => {
    try {
      const res = await api.get(`/integrations/${platform}/logs`);
      setLogs(res.data);
    } catch {
      setLogs([]);
    }
    setLogsModal(platform);
  };

  // ── Connect button dispatcher ───────────────────────────────────────────────

  const handleConnectClick = (platform) => {
    const info = PLATFORM_INFO[platform];
    if (!info) return;
    if (info.authType === 'oauth') {
      if (platform === 'shopify') {
        setConnectModal('shopify'); // show domain input first
      } else {
        startOAuth(platform); // TiendaNube: direct redirect
      }
    } else {
      setConnectModal(platform); // MercadoLibre: manual form
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Platform cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)
        ) : (
          integrations.map((integration) => {
            const info = PLATFORM_INFO[integration.platform];
            if (!info) return null;
            const st = STATUS_INFO[integration.sync_status] || STATUS_INFO.idle;
            const StatusIcon = st.icon;
            const isSyncing = syncing[integration.platform] || integration.sync_status === 'syncing';

            return (
              <div
                key={integration.platform}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl ${info.color} flex items-center justify-center text-xl shadow-sm flex-shrink-0`}>
                    {info.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{info.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StatusIcon
                        size={12}
                        className={
                          integration.sync_status === 'success' ? 'text-emerald-500'
                          : integration.sync_status === 'error' ? 'text-red-500'
                          : integration.sync_status === 'syncing' ? 'text-blue-500 animate-spin'
                          : 'text-slate-400'
                        }
                      />
                      <span className="text-xs text-slate-400">{st.label}</span>
                    </div>
                  </div>
                  <Badge variant={integration.is_active ? 'green' : 'gray'} className="text-xs flex-shrink-0">
                    {integration.is_active ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 leading-relaxed">
                  {info.description}
                </p>

                {/* OAuth badge */}
                {info.authType === 'oauth' && !integration.is_active && (
                  <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 mb-3">
                    <Zap size={11} />
                    OAuth 2.0 — autorización segura
                  </div>
                )}

                {/* Error message */}
                {integration.sync_error && (
                  <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-3 break-words">
                    {integration.sync_error}
                  </div>
                )}

                {/* Last sync */}
                {integration.last_sync && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                    Última sync: {new Date(integration.last_sync).toLocaleString('es-AR')}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-auto space-y-2">
                  {integration.is_active ? (
                    <>
                      <SyncMenu
                        platform={integration.platform}
                        onSync={handleSync}
                        disabled={isSyncing}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => openLogs(integration.platform)}
                          className="flex-1 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-manipulation"
                        >
                          Ver logs
                        </button>
                        <button
                          onClick={() => handleDisconnect(integration.platform)}
                          className="flex-1 text-xs text-red-500 hover:text-red-600 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors touch-manipulation flex items-center justify-center gap-1"
                        >
                          <Link2Off size={12} /> Desconectar
                        </button>
                      </div>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleConnectClick(integration.platform)}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {info.authType === 'oauth'
                        ? <><ExternalLink size={14} /> Conectar con {info.name}</>
                        : <><Link2 size={14} /> Conectar</>}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info banner — shown only when no integration is connected */}
      {!loading && integrations.every((i) => !i.is_active) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Zap size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Conectá tu primera plataforma
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                TiendaNube y Shopify usan OAuth 2.0 — serás redirigido para autorizar el acceso de forma segura.
                Asegurate de que el servidor tenga las variables de entorno configuradas antes de conectar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Shopify connect modal (needs domain input) */}
      {connectModal === 'shopify' && (
        <Modal
          isOpen
          onClose={() => setConnectModal(null)}
          title="Conectar Shopify"
        >
          <ShopifyConnectModal
            onConnect={(shop) => { setConnectModal(null); startOAuth('shopify', shop); }}
            onClose={() => setConnectModal(null)}
          />
        </Modal>
      )}

      {/* Manual connect modal (MercadoLibre) */}
      {connectModal && connectModal !== 'shopify' && PLATFORM_INFO[connectModal]?.authType === 'manual' && (
        <Modal
          isOpen
          onClose={() => setConnectModal(null)}
          title={`Conectar ${PLATFORM_INFO[connectModal]?.name}`}
        >
          <ManualConnectModal
            platform={connectModal}
            info={PLATFORM_INFO[connectModal]}
            onConnect={handleManualConnect}
            onClose={() => setConnectModal(null)}
            connecting={connecting}
          />
        </Modal>
      )}

      {/* Logs modal */}
      {logsModal && (
        <Modal
          isOpen
          onClose={() => setLogsModal(null)}
          title={`Logs — ${PLATFORM_INFO[logsModal]?.name}`}
        >
          <LogsModal logs={logs} onClose={() => setLogsModal(null)} />
        </Modal>
      )}
    </div>
  );
}
