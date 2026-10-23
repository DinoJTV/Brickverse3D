// main.js — boots the game: checks the browser, loads the save, builds the catalogue,
// creates every screen and shows the main menu. Any error is shown clearly on screen.
import { Game } from './game.js';
import { Menu } from './menu.js';
import { Store } from './store.js';
import { Collection } from './inventory.js';
import { BoxOpening } from './boxOpening.js';
import { Studio } from './building.js';
import { CollectionRoom } from './collectionRoom.js';
import { Sorting } from './sorting.js';
import { Trailer } from './trailer.js';
import { modal, toast } from './ui.js';
import { exportSaveFile } from './saveSystem.js';

const bootBar = document.querySelector('#boot .boot-fill');
const bootText = document.querySelector('#boot .boot-text');
const progress = (text, k) => { bootText.textContent = text; bootBar.style.width = Math.round(k * 100) + '%'; };

let game = null;
function showFatal(err) {
  console.error(err);
  const box = document.getElementById('fatal');
  box.querySelector('.fatal-msg').textContent = err && err.message ? err.message : String(err);
  box.classList.add('show');
  document.getElementById('boot').classList.add('hide');
}
window.addEventListener('error', e => showFatal(e.error || e.message));
window.addEventListener('unhandledrejection', e => showFatal(e.reason));
window.addEventListener('bv-fatal', e => showFatal(e.detail));
document.getElementById('fatal-reload').addEventListener('click', () => location.reload());
document.getElementById('fatal-backup').addEventListener('click', () => {
  if (!game || !game.save) { toast('No progress is loaded yet, so there is nothing to back up.', 'info'); return; }
  const blob = new Blob([exportSaveFile(game.save)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'brickverse-backup.json'; a.click();
});

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

async function boot() {
  // make sure the game fonts are ready before painting box art and booklets
  try { await Promise.race([Promise.all(['600 20px Fredoka', '700 20px Fredoka', '700 16px Nunito'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]); } catch { /* fonts are optional */ }
  if (!webglOk()) throw new Error('Your browser or graphics driver does not support WebGL, which BrickVerse 3D needs for its 3D graphics. Try the latest Google Chrome, and make sure "Use graphics acceleration" is turned on in Chrome settings.');
  game = new Game();
  window.__brickverse = game;          // handy for debugging in the browser console
  await game.init(progress);
  const screens = {
    menu: new Menu(game), store: new Store(game), collection: new Collection(game),
    opening: new BoxOpening(game), sorting: new Sorting(game), studio: new Studio(game), room: new CollectionRoom(game),
  };
  for (const [id, s] of Object.entries(screens)) game.register(id, s);
  // the start-up trailer (skippable; can be switched off on its title card or in Settings)
  if (game.save.settings.playTrailer !== false) {
    document.getElementById('boot').classList.add('hide');
    try { await new Trailer(game).run(); } catch (e) { console.warn('Trailer could not play', e); }
  }
  await game.show('menu');
  document.getElementById('boot').classList.add('hide');
  if (game.loadNotes.length) modal({ title: 'About your saved progress', body: game.loadNotes.join(' '), actions: [{ label: 'OK', kind: 'primary' }] });
  else if (game.isNewPlayer) { screens.menu.openHelp(true); game.requestSave(true); }
  else if (!game.prog.dailyStatus().claimedToday) toast('Your daily reward is ready! Click 🎁 to claim it.', 'money', 5000);
  if (game.storageMode === 'memory') toast('Saving is unavailable in this browser mode (private window?). Progress will be lost when you close the tab.', 'error', 8000);
}

boot().catch(showFatal);
