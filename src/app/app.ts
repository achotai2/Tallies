import { createElement } from '../ui/dom';
import {
  createLocalTally,
  listTalliesByDate,
  listSyncCounts,
} from '../features/tallies/tallies';
import type { CreateTallyInput, TallyRecord } from '../features/tallies/types';
import { syncTallies } from '../sync/sync';

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const renderTallyItem = (tally: TallyRecord): HTMLElement => {
  const item = createElement('div', { className: 'tally-item' });
  const title = createElement('div', {
    text: `${tally.trees} trees${tally.block_name ? ` · ${tally.block_name}` : ''}`,
  });
  const meta = createElement('div', { className: 'tally-meta' });
  const status = createElement('span', {
    text: tally.sync_status,
  });
  const time = new Date(tally.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const timeEl = createElement('span', { text: time });
  meta.append(status, timeEl);

  if (tally.notes) {
    const notes = createElement('div', { className: 'small', text: tally.notes });
    item.append(title, meta, notes);
  } else {
    item.append(title, meta);
  }

  if (tally.sync_status === 'error' && tally.sync_error) {
    const error = createElement('div', {
      className: 'small',
      text: `Sync error: ${tally.sync_error}`,
    });
    item.append(error);
  }

  return item;
};

export const initApp = (): void => {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) return;

  root.innerHTML = '';

  const header = createElement('h1', { text: 'Tree Tally' });
  const formCard = createElement('section', { className: 'card' });
  const listCard = createElement('section', { className: 'card' });
  const syncCard = createElement('section', { className: 'card' });

  const form = document.createElement('form');
  const dateField = createElement('input') as HTMLInputElement;
  dateField.type = 'date';
  dateField.required = true;
  dateField.value = todayISO();

  const treesField = createElement('input') as HTMLInputElement;
  treesField.type = 'number';
  treesField.min = '1';
  treesField.placeholder = 'Trees planted';
  treesField.required = true;

  const blockField = createElement('input') as HTMLInputElement;
  blockField.placeholder = 'Block name (optional)';

  const notesField = document.createElement('textarea');
  notesField.rows = 3;
  notesField.placeholder = 'Notes (optional)';

  const submitButton = createElement('button', { text: 'Save tally' }) as HTMLButtonElement;
  submitButton.type = 'submit';

  form.append(
    createElement('label', { text: 'Date' }),
    dateField,
    createElement('label', { text: 'Trees' }),
    treesField,
    createElement('label', { text: 'Block name' }),
    blockField,
    createElement('label', { text: 'Notes' }),
    notesField,
    submitButton
  );
  formCard.append(form);

  const listTitle = createElement('h2', { text: 'Today' });
  const tallyList = createElement('div', { className: 'tally-list' });
  listCard.append(listTitle, tallyList);

  const syncTitle = createElement('h2', { text: 'Sync status' });
  const statusRow = createElement('div', { className: 'status-row' });
  const pendingPill = createElement('span', { className: 'status-pill pending' });
  const syncedPill = createElement('span', { className: 'status-pill synced' });
  const errorPill = createElement('span', { className: 'status-pill error' });
  statusRow.append(pendingPill, syncedPill, errorPill);

  const syncButton = createElement('button', { text: 'Sync now' }) as HTMLButtonElement;
  syncButton.className = 'secondary';
  const retryButton = createElement('button', { text: 'Retry sync' }) as HTMLButtonElement;

  const syncMessage = createElement('div', { className: 'small' });

  syncCard.append(syncTitle, statusRow, syncButton, retryButton, syncMessage);

  root.append(header, formCard, listCard, syncCard);

  const refreshTallies = async (): Promise<void> => {
    const date = dateField.value;
    const tallies = await listTalliesByDate(date);
    tallyList.innerHTML = '';
    if (tallies.length === 0) {
      tallyList.append(createElement('div', { className: 'small', text: 'No tallies yet.' }));
    } else {
      tallies.forEach((tally) => tallyList.append(renderTallyItem(tally)));
    }
  };

  const refreshCounts = async (): Promise<void> => {
    const counts = await listSyncCounts();
    pendingPill.textContent = `Pending: ${counts.pending}`;
    syncedPill.textContent = `Synced: ${counts.synced}`;
    errorPill.textContent = `Error: ${counts.error}`;
  };

  const refreshAll = async (): Promise<void> => {
    await Promise.all([refreshTallies(), refreshCounts()]);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    const input: CreateTallyInput = {
      date: dateField.value,
      trees: Number(treesField.value),
      notes: notesField.value,
      block_name: blockField.value,
    };

    await createLocalTally(input);
    form.reset();
    dateField.value = input.date;
    submitButton.disabled = false;
    await refreshAll();
  });

  dateField.addEventListener('change', () => {
    refreshTallies();
  });

  const handleSync = async () => {
    syncButton.disabled = true;
    retryButton.disabled = true;
    syncMessage.textContent = navigator.onLine ? 'Syncing...' : 'Offline. Will retry later.';
    const result = await syncTallies();
    if (result.skipped) {
      syncMessage.textContent = 'Offline. Tallies will sync when back online.';
    } else if (result.failed > 0) {
      syncMessage.textContent = `Sync finished with ${result.failed} failures.`;
    } else {
      syncMessage.textContent = `Synced ${result.synced} tallies.`;
    }
    syncButton.disabled = false;
    retryButton.disabled = false;
    await refreshAll();
  };

  syncButton.addEventListener('click', handleSync);
  retryButton.addEventListener('click', handleSync);

  refreshAll();
};
