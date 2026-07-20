'use client';

// PWA utilities for client-side components
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function initPWA() {
  if (typeof window === 'undefined') return;

  // Listen for install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log('[PWA] Install prompt available');
  });

  // Listen for install success
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;
  });

  // Listen for online/offline events
  window.addEventListener('online', () => {
    document.body.classList.remove('offline');
    console.log('[PWA] Back online');
  });

  window.addEventListener('offline', () => {
    document.body.classList.add('offline');
    console.log('[PWA] Gone offline');
  });

  // Set initial state
  if (!navigator.onLine) {
    document.body.classList.add('offline');
  }
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    console.log('[PWA] No install prompt available');
    return false;
  }
  
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return outcome === 'accepted';
  } catch (e) {
    console.error('[PWA] Install prompt failed:', e);
    return false;
  }
}

export function canInstall(): boolean {
  return deferredPrompt !== null;
}

export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}

export function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service workers not supported');
    return Promise.resolve(null);
  }

  return navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('[PWA] SW registered:', registration.scope);
      
      // Check for updates every hour
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
      
      return registration;
    })
    .catch((error) => {
      console.error('[PWA] SW registration failed:', error);
      return null;
    });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  
  if (Notification.permission === 'granted') return true;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}
