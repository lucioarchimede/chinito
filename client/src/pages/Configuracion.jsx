import { useState, useEffect } from 'react';
import { User, Lock, Users, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
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

  return (
    <div className="max-w-2xl">
      {/* Tabs */}
      <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm mb-5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${tab === id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* Perfil */}
      {tab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Información de perfil</h2>
          {profileMsg && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <CheckCircle size={16} /> {profileMsg}
            </div>
          )}
          {profileError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{profileError}</div>
          )}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input label="Nombre" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-1">El email no se puede modificar</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <div className="flex items-center gap-2">
                <Badge variant={user?.role === 'admin' ? 'indigo' : 'gray'} className="capitalize text-sm px-3 py-1">
                  {user?.role}
                </Badge>
              </div>
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>
        </div>
      )}

      {/* Contraseña */}
      {tab === 'security' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Cambiar contraseña</h2>
          {profileMsg && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <CheckCircle size={16} /> {profileMsg}
            </div>
          )}
          {profileError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{profileError}</div>
          )}
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

      {/* Gestión de usuarios (admin) */}
      {tab === 'users' && user?.role === 'admin' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Crear nuevo usuario</h2>
            {userMsg && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm">
                <CheckCircle size={16} /> {userMsg}
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

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Usuarios del sistema</h3>
            </div>
            {loadingUsers ? (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {users.map(u => (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                      {u.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge variant={u.role === 'admin' ? 'indigo' : 'gray'} className="capitalize">{u.role}</Badge>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(u.created_at)}</p>
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
