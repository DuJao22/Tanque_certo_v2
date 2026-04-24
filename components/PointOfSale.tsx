import React, { useState } from 'react';
import { motion } from 'motion/react';
import { playBeep } from '../lib/sounds';
import { Product } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Barcode, Search, ShoppingCart, Trash2, Loader2, Tag, Plus, Minus } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';

interface CartItem {
  product: Product;
  qty: number;
}

export const PointOfSale: React.FC = () => {
  const [showScanner, setShowScanner] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searching, setSearching] = useState(false);

  const searchProduct = async (code: string) => {
    if (!code || searching) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/products/search/${code}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const product: Product = await res.json();
        setLastScanned(product);
        playBeep('success');
        if ((product.external_qty || 0) <= 0) {
           toast.warning("Atenção: Produto sem estoque na pista!");
        }
      } else {
        playBeep('error');
        toast.error("Produto não cadastrado", { id: 'product-not-found' });
        setLastScanned(null);
      }
    } catch (e) {
      toast.error("Erro ao buscar", { id: 'search-error' });
    } finally {
      setSearching(false);
      setManualBarcode('');
    }
  };

  const [lastScanned, setLastScanned] = useState<Product | null>(null);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
    setLastScanned(null);
    toast.success(`${product.name} adicionado ao carrinho!`);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm("Deseja realmente limpar o carrinho?")) {
      setCart([]);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    let hasError = false;
    for (const item of cart) {
      try {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ barcode: item.product.barcode, qty: item.qty })
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(`Erro no produto ${item.product.name}: ${data.error}`);
          hasError = true;
          break;
        }
      } catch (e) {
        hasError = true;
        break;
      }
    }

    if (!hasError) {
      playBeep('success');
      toast.success("Venda realizada com sucesso!", { id: 'checkout-success' });
      setCart([]);
    }
  };

  const total = cart.reduce((acc, item) => acc + (item.product.price * item.qty), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-0">
      <Card className="border-t-4 border-t-yellow-400">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              PDV / Vendas na Pista
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowScanner(true)} className="font-bold">
              <Barcode className="w-4 h-4 mr-2" />
              SCANNER
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2">
            <Input 
              value={manualBarcode} 
              onChange={e => setManualBarcode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchProduct(manualBarcode)}
              placeholder="Digite o código de barras" 
              className="h-12 text-lg font-mono"
            />
            <Button onClick={() => searchProduct(manualBarcode)} disabled={searching || !manualBarcode} className="h-12 px-6">
              {searching ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </div>

          {lastScanned && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-zinc-900 text-white rounded-3xl space-y-4 border-2 border-yellow-400 shadow-xl"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">{lastScanned.name}</h3>
                  <p className="text-zinc-400 font-mono text-sm">{lastScanned.barcode}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400 uppercase font-bold">Preço Unitário</p>
                  <p className="text-3xl font-black text-yellow-400">R$ {lastScanned.price.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 py-2 border-t border-white/10">
                <div className="flex-1">
                  <p className="text-[10px] text-zinc-500 uppercase font-black">Estoque na Pista</p>
                  <p className={`font-bold ${lastScanned.external_qty && lastScanned.external_qty > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {lastScanned.external_qty || 0} unidades disponíveis
                  </p>
                </div>
                <Button 
                  onClick={() => addToCart(lastScanned)} 
                  className="bg-yellow-400 text-black hover:bg-yellow-500 font-black px-8"
                >
                  ADICIONAR AO CARRINHO
                </Button>
              </div>
            </motion.div>
          )}

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-black text-xs uppercase text-zinc-400 tracking-widest">Carrinho</h4>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart} className="text-zinc-400 hover:text-red-500 h-6 px-2 text-[10px] font-bold">
                  LIMPAR CARRINHO
                </Button>
              )}
            </div>
            {cart.length === 0 ? (
              <div className="text-center py-20 bg-zinc-50 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center space-y-4">
                <Tag className="w-12 h-12 text-zinc-200" />
                <p className="text-zinc-400 font-medium">Nenhum produto selecionado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center justify-between p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex-1">
                      <div className="font-black">{item.product.name}</div>
                      <div className="text-xs text-zinc-400 font-mono">Unit: R$ {item.product.price.toFixed(2)}</div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 rounded-lg hover:bg-white"
                          onClick={() => updateQuantity(item.product.id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center font-black">{item.qty}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 rounded-lg hover:bg-white"
                          onClick={() => updateQuantity(item.product.id, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="text-right min-w-[80px]">
                        <div className="font-black text-lg">R$ {(item.product.price * item.qty).toFixed(2)}</div>
                      </div>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeFromCart(item.product.id)} 
                        className="text-zinc-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="border-t pt-6 space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-zinc-400 font-bold uppercase tracking-widest text-sm">Total da Venda</span>
                <span className="text-4xl font-black tracking-tighter">R$ {total.toFixed(2)}</span>
              </div>
              <Button onClick={handleCheckout} className="w-full h-14 text-xl font-black uppercase tracking-tighter">
                Finalizar Venda
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showScanner && (
        <BarcodeScanner 
          onScan={(code) => searchProduct(code)} 
          onClose={() => setShowScanner(false)} 
        />
      )}
    </div>
  );
};
