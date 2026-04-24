import React, { useState, useEffect } from 'react';
import { playBeep } from '../lib/sounds';
import { Product, Posto } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Barcode, Plus, ArrowRightLeft, Package, Search, Loader2, MapPin } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { useAuth } from './AuthProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const ProductInventory: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [postos, setPostos] = useState<Posto[]>([]);
  const [selectedPostoId, setSelectedPostoId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerPurpose, setScannerPurpose] = useState<'register' | 'search'>('register');

  // Form states
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const fetchPostos = async () => {
    try {
      const res = await fetch('/api/postos', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPostos(data);
        if (data.length > 0 && !selectedPostoId) {
          setSelectedPostoId(data[0].id.toString());
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    const postoId = user?.role === 'SUPERADMIN' ? selectedPostoId : user?.posto_id;
    if (!postoId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/products?posto_id=${postoId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setProducts(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'SUPERADMIN') {
      fetchPostos();
    } else {
      fetchProducts();
    }
  }, [user]);

  useEffect(() => {
    if (selectedPostoId || user?.posto_id) {
      fetchProducts();
    }
  }, [selectedPostoId]);

  const handleRegisterProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode || !name || !price) return toast.error("Preencha todos os campos");
    
    const postoId = user?.role === 'SUPERADMIN' ? selectedPostoId : user?.posto_id;
    if (!postoId) return toast.error("Selecione um posto");

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          barcode,
          name,
          price: parseFloat(price),
          internal_qty: parseInt(qty) || 0,
          posto_id: parseInt(postoId.toString())
        })
      });

      if (res.ok) {
        playBeep('success');
        toast.success(user?.role === 'SUPERADMIN' ? "Distribuição enviada para a sala do posto!" : "Produto atualizado no estoque interno!", { id: 'reg-success' });
        setBarcode(''); setName(''); setPrice(''); setQty('');
        fetchProducts();
      } else {
        const data = await res.json();
        playBeep('error');
        toast.error(data.error, { id: 'reg-error' });
      }
    } catch (e) {
      toast.error("Erro ao conectar");
    }
  };

  const handleTransfer = async (p: Product) => {
    const amount = parseInt(transferQty);
    if (isNaN(amount) || amount <= 0) return toast.error("Quantidade inválida");
    if (amount > (p.internal_qty || 0)) return toast.error("Estoque interno insuficiente");

    try {
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ barcode: p.barcode, qty: amount })
      });

      if (res.ok) {
        toast.success("Transferência realizada para a pista!");
        setTransferQty('');
        setSelectedProduct(null);
        fetchProducts();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch (e) {
      toast.error("Erro de rede");
    }
  };

  const onScanBarcode = async (code: string) => {
    if (!code) return;
    setBarcode(code);
    // Auto-search if item exists
    const postoId = user?.role === 'SUPERADMIN' ? selectedPostoId : user?.posto_id;
    try {
      const res = await fetch(`/api/products/search/${code}?posto_id=${postoId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setName(data.name);
        setPrice(data.price.toString());
        playBeep('success');
        toast.info("Produto carregado!", { id: 'product-loaded' });
      } else {
        // If not found during registry, maybe don't error but just signal once
        playBeep('error');
        toast.error("Produto não cadastrado", { id: 'product-not-found' });
      }
    } catch (e) {
      toast.error("Erro ao buscar", { id: 'search-error' });
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      {user?.role === 'SUPERADMIN' && (
        <Card className="bg-zinc-900 text-white border-none overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-400 rounded-2xl text-black">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter">Gestão Global de Estoque</h2>
                  <p className="text-zinc-400 text-sm">Selecione um posto para distribuir produtos.</p>
                </div>
              </div>
              <div className="w-full md:w-64">
                <Select value={selectedPostoId} onValueChange={setSelectedPostoId}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white h-12 rounded-xl">
                    <SelectValue placeholder="Selecione o posto" />
                  </SelectTrigger>
                  <SelectContent>
                    {postos.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {user?.role === 'SUPERADMIN' ? 'Enviar Mercadoria para Posto' : 'Entrada de Mercadoria (Estoque Interno)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegisterProduct} className="space-y-4">
              <div className="space-y-2">
                <Label>Código de Barras</Label>
                <div className="flex gap-2">
                  <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="0000000000000" required />
                  <Button type="button" variant="outline" onClick={() => setShowScanner(true)}>
                    <Barcode className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Produto</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Óleo Shell 1L" required />
                </div>
                <div className="space-y-2">
                  <Label>Preço de Venda (R$)</Label>
                  <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quantidade p/ Entrada {user?.role === 'SUPERADMIN' ? '(Destino: Sala do Posto)' : '(Estoque da Sala/Gerente)'}</Label>
                <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="Quantidade" required />
              </div>
              <Button type="submit" className="w-full font-bold h-12">
                <Plus className="w-4 h-4 mr-2" /> 
                {user?.role === 'SUPERADMIN' ? 'Distribuir para o Posto' : 'Registrar no estoque da Sala'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Inventory List */}
        <Card>
          <CardHeader>
            <CardTitle>Posição de Estoque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {products.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground italic">
                  Nenhum produto cadastrado.
                </div>
              ) : (
                products.map(p => (
                  <div key={p.id} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-bold text-lg">{p.name}</div>
                      <div className="text-xs font-mono text-zinc-400">{p.barcode}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-white border-zinc-200">Sala: {p.internal_qty || 0}</Badge>
                        <Badge variant="outline" className="bg-white border-zinc-200">Pista: {p.external_qty || 0}</Badge>
                        <Badge className="bg-green-100 text-green-700">R$ {p.price.toFixed(2)}</Badge>
                      </div>
                    </div>
                    {user?.role !== 'SUPERADMIN' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Input 
                            type="number" 
                            placeholder="Qtd" 
                            className="w-20"
                            value={selectedProduct?.id === p.id ? transferQty : ''}
                            onChange={e => {
                              setSelectedProduct(p);
                              setTransferQty(e.target.value);
                            }}
                          />
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => handleTransfer(p)}
                            className="font-bold flex-1 md:flex-none"
                          >
                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                            Enviar p/ Pista
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {showScanner && (
        <BarcodeScanner 
          onScan={onScanBarcode} 
          onClose={() => setShowScanner(false)} 
        />
      )}
    </div>
  );
};
