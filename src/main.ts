import './style.css';
import { initApp } from './app/app';
// Import the automatic registrar from the plugin
import { registerSW } from 'virtual:pwa-register';

initApp();

// This replaces the entire "if ('serviceWorker' in navigator)" block.
// It automatically handles the path, registration, and updates for you.
registerSW({ immediate: true });