import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const isDoneRef = useRef(false);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("qr-reader");
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        // Attempt to start with back camera
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (isDoneRef.current) return;
            isDoneRef.current = true;
            onScan(decodedText);
            stopScanner().then(onClose);
          },
          () => {} // Ignore scan failures
        );
        setIsReady(true);
      } catch (err: any) {
        console.error("Erro ao iniciar a câmera:", err);
        setError("Não foi possível acessar a câmera. Certifique-se de que deu permissão e se o seu navegador suporta acesso à câmera via iframe.");
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.error("Erro ao parar a câmera:", e);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] p-6 w-full max-w-md space-y-6 shadow-2xl">
        <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-yellow-500" />
            <h3 className="text-xl font-black tracking-tighter uppercase">Scanner</h3>
          </div>
          <button 
            onClick={() => stopScanner().then(onClose)}
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="relative aspect-square overflow-hidden rounded-3xl bg-zinc-900 border-4 border-zinc-100">
          <div id="qr-reader" className="w-full h-full" />
          
          {!isReady && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-4">
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
              <p className="text-sm font-bold uppercase tracking-widest text-zinc-400">Iniciando câmera...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <p className="text-red-400 text-sm font-medium">{error}</p>
              <Button 
                variant="outline"
                className="text-white border-white hover:bg-white/10"
                onClick={() => window.location.reload()}
              >
                Recarregar Página
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4 text-center">
          <p className="text-sm text-zinc-500 font-medium">
            Posicione o código de barras no centro do quadrado.
          </p>
          <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
            <p className="text-[10px] text-zinc-400 font-bold uppercase leading-tight">
              Nota: Se a câmera não abrir, clique no ícone "Abrir em nova aba" no canto superior direito para dar permissão total ao navegador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
