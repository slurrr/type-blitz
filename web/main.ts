import { TypeBlitzWebApp } from '../src/web/app.js';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('terminal-container');
  if (container) {
    new TypeBlitzWebApp(container);
  }
});
