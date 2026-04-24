import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, Posto } from '../types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import { UserPlus, MapPin, Shield, Users, Settings2, Save } from 'lucide-react';
import { TankState } from '../types';
import { TANKS } from '../constants';

export const UserManagement: React.FC = React.memo(() => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [postos, setPostos] = useState<Posto[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('OPERADOR');
  const [newPostoId, setNewPostoId] = useState<string>('');
  const [newPostoName, setNewPostoName] = useState('');
  const [tankConfigs, setTankConfigs] = useState<TankState[]>([]);
  const [selectedConfigPosto, setSelectedConfigPosto] = useState<string>('');

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    setLoading(true);
    try {
      const usersRes = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!usersRes.ok) {
        const errorData = await usersRes.json();
        throw new Error(errorData.error || 'Falha ao buscar usuários');
      }
      
      const usersData = await usersRes.json();
      setUsers(usersData);

      if (user?.role === 'SUPERADMIN') {
        const postosRes = await fetch('/api/postos', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (postosRes.ok) {
          setPostos(await postosRes.json());
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro de conexão ao buscar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user?.id]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    const payload = {
      username: newUsername,
      password: newPassword,
      name: newName,
      role: newRole,
      posto_id: user?.role === 'SUPERADMIN' ? parseInt(newPostoId) : user?.posto_id
    };

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("Usuário criado com sucesso!");
        setNewUsername('');
        setNewPassword('');
        setNewName('');
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro ao criar usuário");
      }
    } catch (e) {
      toast.error("Erro de conexão");
    }
  };

  const handleCreatePosto = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/postos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newPostoName })
      });

      if (res.ok) {
        toast.success("Posto criado com sucesso!");
        setNewPostoName('');
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro ao criar posto");
      }
    } catch (e) {
      toast.error("Erro de conexão");
    }
  };

  const fetchTankConfigs = async (postoId: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/tanks?posto_id=${postoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTankConfigs(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedConfigPosto) {
      fetchTankConfigs(selectedConfigPosto);
    }
  }, [selectedConfigPosto]);

  const handleUpdateTank = async (tank: TankState) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/tanks/${tank.code}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          capacity: isNaN(tank.capacity) ? 0 : tank.capacity,
          min_stock: isNaN(tank.min_stock) ? 0 : tank.min_stock,
          posto_id: tank.posto_id
        })
      });

      if (res.ok) {
        toast.success(`Configuração do tanque ${tank.code} atualizada!`);
      } else {
        toast.error("Erro ao atualizar tanque");
      }
    } catch (e) {
      toast.error("Erro de conexão");
    }
  };

  if (loading) return <div className="text-center py-10">Carregando...</div>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create User Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Criar Novo {user?.role === 'SUPERADMIN' ? 'Gerente' : 'Colaborador'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Usuário (Login)</Label>
                  <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select 
                    value={newRole} 
                    onValueChange={(v: any) => setNewRole(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {user?.role === 'SUPERADMIN' ? (
                        <SelectItem value="GERENTE">Gerente de Posto</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="CAIXA">Caixa</SelectItem>
                          <SelectItem value="FRENTISTA">Frentista</SelectItem>
                          <SelectItem value="OPERADOR">Operador de Pista</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {user?.role === 'SUPERADMIN' && (
                <div className="space-y-2">
                  <Label>Vincular ao Posto</Label>
                  <Select value={newPostoId} onValueChange={setNewPostoId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o posto" />
                    </SelectTrigger>
                    <SelectContent>
                      {postos.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="w-full font-bold">Criar Usuário</Button>
            </form>
          </CardContent>
        </Card>

        {/* Create Posto Form (Superadmin only) */}
        {user?.role === 'SUPERADMIN' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Cadastrar Novo Posto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreatePosto} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Posto</Label>
                  <Input 
                    placeholder="Ex: Posto Shell Centro" 
                    value={newPostoName} 
                    onChange={e => setNewPostoName(e.target.value)} 
                    required 
                  />
                </div>
                <Button type="submit" variant="secondary" className="w-full font-bold">Cadastrar Posto</Button>
              </form>
              
              <div className="mt-6">
                <Label className="text-xs font-bold uppercase text-zinc-400">Postos Cadastrados</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {postos.map(p => (
                    <Badge key={p.id} variant="outline" className="px-3 py-1">
                      {p.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Usuários Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Posto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-bold">{u.name}</TableCell>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>
                      <Badge variant={
                        u.role === 'SUPERADMIN' ? 'destructive' : 
                        u.role === 'GERENTE' ? 'default' : 
                        u.role === 'CAIXA' ? 'outline' :
                        u.role === 'FRENTISTA' ? 'secondary' : 'secondary'
                      }>
                        {
                          u.role === 'SUPERADMIN' ? 'Superadmin' :
                          u.role === 'GERENTE' ? 'Gerente' :
                          u.role === 'CAIXA' ? 'Caixa' :
                          u.role === 'FRENTISTA' ? 'Frentista' : u.role
                        }
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.posto_id ? postos.find(p => p.id === u.posto_id)?.name || `Posto #${u.posto_id}` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tank Configuration (Superadmin only) */}
      {user?.role === 'SUPERADMIN' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Configuração de Tanques e Estoque Mínimo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="max-w-xs space-y-2">
              <Label>Selecione o Posto para Configurar</Label>
              <Select value={selectedConfigPosto} onValueChange={setSelectedConfigPosto}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um posto" />
                </SelectTrigger>
                <SelectContent>
                  {postos.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedConfigPosto && tankConfigs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tankConfigs.map(tank => {
                  const tankDef = TANKS.find(t => t.code === tank.code);
                  return (
                    <Card key={tank.code} className="bg-zinc-50 border-zinc-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>{tankDef?.shortName || tank.code}</span>
                          <Badge variant="outline">{tank.code}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Capacidade Total (L)</Label>
                          <Input 
                            type="number" 
                            value={Number.isFinite(tank.capacity) ? tank.capacity : ''} 
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              const newConfigs = tankConfigs.map(tc => 
                                tc.code === tank.code ? { ...tc, capacity: val } : tc
                              );
                              setTankConfigs(newConfigs);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Estoque Mínimo (Alerta) (L)</Label>
                          <Input 
                            type="number" 
                            value={Number.isFinite(tank.min_stock) ? tank.min_stock : ''} 
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              const newConfigs = tankConfigs.map(tc => 
                                tc.code === tank.code ? { ...tc, min_stock: val } : tc
                              );
                              setTankConfigs(newConfigs);
                            }}
                          />
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full gap-2" 
                          onClick={() => handleUpdateTank(tank)}
                        >
                          <Save className="w-4 h-4" />
                          Salvar Tanque
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : selectedConfigPosto ? (
              <div className="text-center py-10 text-muted-foreground bg-zinc-50 rounded-xl border-2 border-dashed">
                Nenhum tanque inicializado para este posto. 
                <p className="text-xs mt-1">Os tanques aparecem aqui após a primeira medição ser realizada.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
});
