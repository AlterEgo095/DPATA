'use client';

// PWA Provider - Gère l'enregistrement du Service Worker et l'installation
import { useEffect, useState, useCallback } from 'react';
import { initPWA, canInstall, promptInstall, isInstalled, isOnline } from '@/lib/pwa';

interface PWAState {
  isInstalled: boolean;
  canInstall: boolean;
  isOnline: boolean;
  showInstallPrompt: boolean;
  installing: boolean;
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [pwaState, setPwaState] = useState<PWAState>({
    isInstalled: false,
    canInstall: false,
    isOnline: true,
    showInstallPrompt: false,
    installing: false,
  });

  useEffect(() => {
    // Initialiser PWA
    initPWA();

    // État initial
    setPwaState(prev => ({
      ...prev,
      isInstalled: isInstalled(),
      canInstall: canInstall(),
      isOnline: isOnline(),
    }));

    // Enregistrer le Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service Worker enregistré:', registration.scope);
          
          // Vérifier les mises à jour du SW
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                  console.log('[PWA] Nouvelle version disponible - refresh recommandé');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[PWA] Erreur enregistrement SW:', error);
        });
    }

    // Écouteurs d'événements
    const handleOnline = () => setPwaState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setPwaState(prev => ({ ...prev, isOnline: false }));
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Vérifier périodiquement si installation possible
    const installCheckInterval = setInterval(() => {
      const canInst = canInstall();
      setPwaState(prev => ({ 
        ...prev, 
        canInstall: canInst,
        showInstallPrompt: canInst && !isInstalled()
      }));
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(installCheckInterval);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    setPwaState(prev => ({ ...prev, installing: true }));
    
    try {
      const accepted = await promptInstall();
      if (accepted) {
        setPwaState(prev => ({ 
          ...prev, 
          isInstalled: true, 
          canInstall: false, 
          showInstallPrompt: false 
        }));
      }
    } catch (error) {
      console.error('[PWA] Erreur installation:', error);
    } finally {
      setPwaState(prev => ({ ...prev, installing: false }));
    }
  }, []);

  const dismissInstall = () => {
    setPwaState(prev => ({ ...prev, showInstallPrompt: false }));
  };

  return (
    <>
      {children}
      
      {/* Banner d'installation PWA */}
      {pwaState.showInstallPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-500">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-emerald-200 dark:border-emerald-800 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Installer PlagiatIA
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Accédez rapidement même hors ligne. Installez cette application sur votre appareil.
                </p>
              </div>
              <button 
                onClick={dismissInstall}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                disabled={pwaState.installing}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {pwaState.installing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Installation...
                  </span>
                ) : 'Installer'}
              </button>
              <button
                onClick={dismissInstall}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicateur hors ligne */}
      {!pwaState.isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white py-2 px-4 text-center text-sm z-50 animate-in slide-in-from-top">
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L8 8" />
            </svg>
                Vous êtes hors ligne. Certaines fonctionnalités peuvent être limitées.
          </span>
        </div>
      )}
    </>
  );
}
