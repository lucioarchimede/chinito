import { useState, useEffect } from 'react';
import { User, Lock, Users, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDate } from '../utils/formatters';

export default function Configuracion() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({ name: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'socio' });
  const [savingUser, setSavingUser] = useState(false);
  const [userMsg, setUserMsg] = useState('');

  useEffect(() => {
    if (user) setProfile(p => ({ ...p, name: user.name }));
  }, [user]);

  useEffect(() => {
    if (tab === 'users' && user?.role === 'admin') fetchUsers();
  }, [tab, user]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data);
    } catch { }
    finally { setLoadingUsers(false); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg(''); setProfileError('');
    if (profile.newPassword && profile.newPassword !== profile.confirmPassword) {
      return setProfileError('Las contraseñas no coinciden');
    }
    setSavingProfile(true);
    try {
      await api.put('/auth/profile', {
        name: profile.name,
        currentPassword: profile.newPassword ? profile.currentPassword : undefined,
        newPassword: profile.newPassword || undefined,
      });
      setProfileMsg('Perfil actualizado correctamente');
      setProfile(p => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (err) {
      setProfileError(err.response?.data?.error || 'Error al actualizar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault(); setUserMsg('');
    setSavingUser(true);
    try {
      await api.post('/auth/register', newUser);
      setNewUser({ name: '', email: '', password: '', role: 'socio' });
      setUserMsg('Usuario creado correctamente');
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al crear usuario');
    } finally {
      setSavingUser(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Mi Perfil', icon: User },
    { id: 'security', label: 'Contraseña', icon: Lock },
    ...(user?.role === 'admin' ? [{ id: 'users', label: 'Usuarios', icon: Users }] : []),
  ];

  const SuccessMsg = ({ msg }) => msg ? (
    <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4 text-sm">
      <CheckCircle size={15} /> {msg}
    </div>
  ) : null;

  const ErrorMsg = ({ msg }) => msg ? (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{msg}</div>
  ) : null;

  return (
    <div className="max-w-2xl">
      {/* Tabs */}
      <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white shadow-card mb-5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-2 flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${tab === id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Perfil */}
      {tab === 'profile' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-5">Información de perfil</h2>
          <SuccessMsg msg={profileMsg} />
          <ErrorMsg msg={profileError} />
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input label="Nombre" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} required />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <p className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">{user?.email}</p>
              <p className="text-xs text-slate-400 mt-1">El email no se puede modificar</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Rol</label>
              <Badge variant={user?.role === 'admin' ? 'indigo' : 'gray'} className="capitalize text-xs px-3 py-1">
                {user?.role}
              </Badge>
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>
        </div>
      )}

      {/* Contraseña */}
      {tab === 'security' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-5">Cambiar contraseña</h2>
          <SuccessMsg msg={profileMsg} />
          <ErrorMsg msg={profileError} />
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input label="Contraseña actual" type="password"
              value={profile.currentPassword}
              onChange={e => setProfile(p => ({ ...p, currentPassword: e.target.value }))} required />
            <Input label="Nueva contraseña (mínimo 6 caracteres)" type="password"
              value={profile.newPassword} minLength={6}
              onChange={e => setProfile(p => ({ ...p, newPassword: e.target.value }))} required />
            <Input label="Confirmar nueva contraseña" type="password"
              value={profile.confirmPassword}
              onChange={e => setProfile(p => ({ ...p, confirmPassword: e.target.value }))} required />
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Guardando...' : 'Cambiar contraseña'}
            </Button>
          </form>
        </div>
      )}

      {/* Gestión de usuarios */}
      {tab === 'users' && user?.role === 'admin' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Crear nuevo usuario</h2>
            {userMsg && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4 text-sm">
                <CheckCircle size={15} /> {userMsg}
              </div>
            )}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Nombre" value={newUser.name}
                  onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} required />
                <Input label="Email" type="email" value={newUser.email}
                  onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Contraseña" type="password" value={newUser.password} minLength={6}
                  onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} required />
                <Select label="Rol" value={newUser.role}
                  onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                  <option value="socio">Socio</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              <Button type="submit" disabled={savingUser}>
                {savingUser ? 'Creando...' : 'Crear usuario'}
              </Button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">Usuarios del sistema</h3>
            </div>
            {loadingUsers ? (
              <div className="divide-y divide-slate-100">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {users.map(u => (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                      {u.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge variant={u.role === 'admin' ? 'indigo' : 'gray'} className="capitalize">{u.role}</Badge>
                      <p className="text-xs text-slate-400 mt-1">{formatDate(u.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
