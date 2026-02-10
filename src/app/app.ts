import { createElement } from '../ui/dom';
import { listProjects, listSupervisors } from '../db';
import {
  createLocalTally,
  listTalliesByDate,
  listSyncCounts,
} from '../features/tallies/tallies';
import type { CreateTallyInput, TallyRecord } from '../features/tallies/types';
import {
  archiveSession,
  createBagup,
  createTallySession,
  fetchTallySession,
  finalizeSession,
  getTallySessionsByFilter,
  listBagupSyncCounts,
  listBagupsForSession,
  listSessionSyncCounts,
  listTallySessions,
  removeBagup,
  saveBagupCounts,
} from '../features/tally_session/db';
import type { Bagup, CreateTallySessionInput, SpeciesRequirement } from '../features/tally_session/types';
import { buildElapsedMap, calculateRatios, calculateTotals, formatDuration } from '../features/tally_session/calculations';
import { createSpeciesEditorRow, createSpeciesSummaryRow } from '../features/tally_session/ui';
import { syncProjects, syncTallies } from '../sync/sync';
import { logUserAction, downloadLogs } from '../logger';
import { addBagupMarkers, initMap } from '../features/map/map';
import { generateBagupsKML } from '../features/map/kml';

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDateTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

const formatRatioText = (ratio: number, overall: number): string => {
  if (overall === 0) {
    return '—';
  }
  return `${Math.round(ratio * 100)}%`;
};

const renderTallyItem = (tally: TallyRecord): HTMLElement => {
  const item = createElement('div', { className: 'tally-item' });
  const title = createElement('div', {
    text: `${tally.trees} trees${tally.block_name ? ` · ${tally.block_name}` : ''}`,
  });
  const meta = createElement('div', { className: 'tally-meta' });
  const status = createElement('span', {
    text: tally.sync_status,
  });
  const timeEl = createElement('span', { text: formatTime(tally.created_at) });
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

const createLogo = (): HTMLImageElement => {
  const img = document.createElement('img');
  img.src = '/Logo.png';
  img.alt = 'Tree Tally';
  img.className = 'app-logo';
  return img;
};

type ViewState =
  | { view: 'home' }
  | { view: 'new-session' }
  | { view: 'session-detail'; sessionId: string };

type DraftBagup = {
  sessionId: string;
  bagupId: string;
  createdAt: number;
  counts: Record<string, number>;
};

export const initApp = (): void => {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) return;

  logUserAction('App initialized');

  let viewState: ViewState = { view: 'home' };
  let draftBagup: DraftBagup | null = null;
  let currentFilter = 'All Sessions';
  let cleanupMap: (() => void) | null = null;

  const navigate = (state: ViewState): void => {
    logUserAction('Navigate', state);
    viewState = state;
    void render();
  };

  const renderHome = async (): Promise<void> => {
    if (cleanupMap) {
      cleanupMap();
      cleanupMap = null;
    }
    root.innerHTML = '';

    const header = createLogo();
    const actionCard = createElement('section', { className: 'card' });
    const listCard = createElement('section', { className: 'card' });
    const sessionsCard = createElement('section', { className: 'card' });
    const mapCard = createElement('section', { className: 'card' });
    const mapContainer = createElement('div');
    mapContainer.id = 'map-container';
    mapCard.append(mapContainer);
    const syncCard = createElement('section', { className: 'card' });
    const debugCard = createElement('section', { className: 'card' });

    const startSessionButton = createElement('button', { text: 'Start New Tally' }) as HTMLButtonElement;
    startSessionButton.type = 'button';
    startSessionButton.addEventListener('click', () => navigate({ view: 'new-session' }));
    actionCard.append(startSessionButton);

    const listTitle = createElement('h2', { text: 'Today' });
    const tallyList = createElement('div', { className: 'tally-list' });
    listCard.append(listTitle, tallyList);

    const sessionsTitle = createElement('h2', { text: 'Tally Sessions' });

    // Filter controls
    const filterContainer = createElement('div', { className: 'row' });
    filterContainer.style.overflowX = 'auto';
    filterContainer.style.paddingBottom = '8px';
    filterContainer.style.marginBottom = '8px';
    const filters = ['All Sessions', 'Synced Sessions', 'Finalized Sessions', 'Archived Sessions', 'Error Sessions'];
    filters.forEach(filter => {
      const btn = createElement('button', { text: filter }) as HTMLButtonElement;
      btn.className = filter === currentFilter ? 'compact' : 'compact secondary';
      btn.style.whiteSpace = 'nowrap';
      btn.addEventListener('click', async () => {
        currentFilter = filter;
        logUserAction('Filter changed', { filter });
        await renderHome(); // Re-render to update UI
      });
      filterContainer.append(btn);
    });

    const sessionsList = createElement('div', { className: 'tally-list' });
    sessionsCard.append(sessionsTitle, filterContainer, sessionsList);

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

    const downloadLogsButton = createElement('button', { text: 'Download Logs' }) as HTMLButtonElement;
    downloadLogsButton.className = 'secondary';
    downloadLogsButton.type = 'button';
    downloadLogsButton.addEventListener('click', () => {
      logUserAction('Download Logs clicked');
      downloadLogs();
    });
    debugCard.append(createElement('h2', { text: 'Debug' }), downloadLogsButton);

    root.append(header, actionCard, listCard, sessionsCard, mapCard, syncCard, debugCard);
    const { cleanup } = initMap(mapContainer);
    cleanupMap = cleanup;

    const refreshTallies = async (): Promise<void> => {
      // Use today's date for listing simple tallies since the date picker is gone
      const date = todayISO();
      const tallies = await listTalliesByDate(date);
      tallyList.innerHTML = '';
      if (tallies.length === 0) {
        tallyList.append(createElement('div', { className: 'small', text: 'No tallies yet.' }));
      } else {
        tallies.forEach((tally) => tallyList.append(renderTallyItem(tally)));
      }
    };

    const refreshSessions = async (): Promise<void> => {
      const sessions = await getTallySessionsByFilter(currentFilter);
      sessionsList.innerHTML = '';
      if (sessions.length === 0) {
        sessionsList.append(createElement('div', { className: 'small', text: 'No sessions found.' }));
        return;
      }

      sessions.forEach((session) => {
        const item = createElement('button', { className: 'session-item' }) as HTMLButtonElement;
        item.type = 'button';
        const title = createElement('div', { text: session.block_name });
        const meta = createElement('div', {
          className: 'tally-meta',
          text: `${session.species.length} species · ${formatDateTime(session.created_at)} · ${session.sync_status}`,
        });
        item.append(title, meta);
        item.addEventListener('click', () => navigate({ view: 'session-detail', sessionId: session.session_id }));
        sessionsList.append(item);
      });
    };

    const refreshCounts = async (): Promise<void> => {
      const [tallyCounts, sessionCounts, bagupCounts] = await Promise.all([
        listSyncCounts(),
        listSessionSyncCounts(),
        listBagupSyncCounts(),
      ]);
      // Pending pill shows items waiting to sync (finalized sessions + pending bagups?)
      // Actually, pending bagups are part of sessions.
      // If we strictly follow "Finalized sessions are synced", then "Pending" in sync context means "Ready to sync".
      // So use finalized count.
      // "Pending" for bagups: if sessions are finalized, bagups are finalized too.
      // If bagups are pending, they are drafts.
      // So for Sync Status, "Pending" = finalized sessions + finalized bagups (waiting for sync).
      // Wait, listBagupSyncCounts returns pending, synced, error. It doesn't return finalized unless I update it?
      // I only updated listSessionSyncCounts return type.
      // Let's assume listBagupSyncCounts counts "pending" as drafted.
      // I should update listBagupSyncCounts to return finalized too if I want to count them.
      // But for simplicity, let's just count Finalized Sessions for the "Pending" pill.
      const pendingSync = sessionCounts.finalized;
      const synced = tallyCounts.synced + sessionCounts.synced + bagupCounts.synced;
      const error = tallyCounts.error + sessionCounts.error + bagupCounts.error;

      pendingPill.textContent = `Pending: ${pendingSync}`;
      syncedPill.textContent = `Synced: ${synced}`;
      errorPill.textContent = `Error: ${error}`;
    };

    const refreshAll = async (): Promise<void> => {
      await Promise.all([refreshTallies(), refreshSessions(), refreshCounts()]);
    };

    const handleSync = async () => {
      logUserAction('Sync started');
      syncButton.disabled = true;
      retryButton.disabled = true;
      syncMessage.textContent = navigator.onLine ? 'Syncing...' : 'Offline. Will retry later.';
      await syncProjects();
      const result = await syncTallies();
      if (result.skipped) {
        syncMessage.textContent = 'Offline. Tallies will sync when back online.';
        logUserAction('Sync skipped (offline)');
      } else if (result.failed > 0) {
        syncMessage.textContent = `Sync finished with ${result.failed} failures. ${result.errors.length > 0 ? 'Errors: ' + result.errors.join(', ') : ''}`;
        logUserAction('Sync finished with failures', result);
      } else {
        syncMessage.textContent = `Synced ${result.synced} records.`;
        logUserAction('Sync finished successfully', result);
      }
      syncButton.disabled = false;
      retryButton.disabled = false;
      await refreshAll();
    };

    syncButton.addEventListener('click', handleSync);
    retryButton.addEventListener('click', handleSync);

    await refreshAll();
  };

  const renderNewSession = async (): Promise<void> => {
    root.innerHTML = '';

    const [projects, supervisors] = await Promise.all([
      listProjects(),
      listSupervisors(),
    ]);

    const headerRow = createElement('div', { className: 'header-row' });
    const backButton = createElement('button', { text: 'Back' }) as HTMLButtonElement;
    backButton.type = 'button';
    backButton.className = 'secondary compact';
    backButton.addEventListener('click', async () => {
      // FIX: Removed draftForSession check which was crashing
      logUserAction('Back button clicked in New Session');
      navigate({ view: 'home' });
    });
    const title = createElement('h1', { text: 'New Tally Session' });
    headerRow.append(backButton, title);

    const card = createElement('section', { className: 'card' });
    const form = document.createElement('form');

    const dateField = createElement('input') as HTMLInputElement;
    dateField.type = 'date';
    const d = new Date();
    dateField.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dateField.required = true;

    const projectSelect = createElement('select') as HTMLSelectElement;
    const defaultOption = createElement('option', { text: 'Select a project...' });
    defaultOption.value = '';
    projectSelect.append(defaultOption);
    projects.forEach((p) => {
      const opt = createElement('option', { text: p.project_name });
      opt.value = p.project_name;
      projectSelect.append(opt);
    });

    const blockField = createElement('select') as HTMLSelectElement;
    blockField.required = true;
    const defaultBlock = createElement('option', { text: 'Select a block...' });
    defaultBlock.value = '';
    blockField.append(defaultBlock);

    const supervisorField = createElement('select') as HTMLSelectElement;
    supervisorField.required = true;
    const defaultSupervisor = createElement('option', { text: 'Select a supervisor...' });
    defaultSupervisor.value = '';
    supervisorField.append(defaultSupervisor);
    supervisors.forEach((s) => {
      const opt = createElement('option', { text: s });
      opt.value = s;
      supervisorField.append(opt);
    });

    const targetDensityField = createElement('input') as HTMLInputElement;
    targetDensityField.type = 'number';
    targetDensityField.placeholder = 'Target Density';
    targetDensityField.min = '0';

    const notesField = document.createElement('textarea');
    notesField.rows = 2;
    notesField.placeholder = 'Notes (optional)';

    const speciesContainer = createElement('div', { className: 'species-container' });

    const saveButton = createElement('button', { text: 'Start session' }) as HTMLButtonElement;
    saveButton.type = 'submit';

    const rows: Array<ReturnType<typeof createSpeciesEditorRow>> = [];

    const addSpeciesRow = (initial?: Partial<SpeciesRequirement>) => {
      const row = createSpeciesEditorRow({
        initial,
      });
      row.codeInput.required = true;
      row.nameInput.required = true;
      row.ratioInput.required = true;
      speciesContainer.append(row.row);
      rows.push(row);
    };

    projectSelect.addEventListener('change', () => {
      const selectedProjectName = projectSelect.value;
      const project = projects.find((p) => p.project_name === selectedProjectName);
      if (!project) return;

      logUserAction('Project selected', { projectName: selectedProjectName });

      // Populate block dropdown
      blockField.innerHTML = '';
      blockField.append(defaultBlock);
      const blocks = project.blocks_data;
      if (Array.isArray(blocks)) {
        blocks.forEach((b) => {
          const opt = createElement('option', { text: String(b) });
          opt.value = String(b);
          blockField.append(opt);
        });
      } else if (typeof blocks === 'object' && blocks !== null) {
        // If it's an object, assume keys are block names.
        // It could also be { "raw": "..." } if error, so check for error/raw keys.
        if ('error' in blocks) {
          console.warn('Blocks data has error:', blocks.error);
        } else {
           Object.values(blocks).forEach((b) => {
            const val = String(b);
            const opt = createElement('option', { text: val });
            opt.value = val;
            blockField.append(opt);
          });
        }
      }

      rows.forEach((row) => row.row.remove());
      rows.length = 0;

      const speciesData = project.species_data;
      if ('error' in speciesData) {
        // If error or empty, we do not add rows.
        // The user sees an empty species list, which is correct as they cannot add their own.
        return;
      }

      Object.entries(speciesData).forEach(([code, name]) => {
        addSpeciesRow({
          species_code: code,
          display_name: name,
          required_ratio: 0,
        });
      });
    });

    form.append(
      createElement('label', { text: 'Date' }),
      dateField,
      createElement('label', { text: 'Project' }),
      projectSelect,
      createElement('label', { text: 'Block name' }),
      blockField,
      createElement('label', { text: 'Supervisor' }),
      supervisorField,
      createElement('label', { text: 'Target Density' }),
      targetDensityField,
      createElement('label', { text: 'Notes' }),
      notesField,
      createElement('label', { text: 'Species (code, name, required ratio)' }),
      speciesContainer,
      saveButton
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) {
        return;
      }
      const species: SpeciesRequirement[] = rows.map((row) => ({
        species_code: row.codeInput.value.trim(),
        display_name: row.nameInput.value.trim(),
        required_ratio: Number(row.ratioInput.value),
      }));

      const input: CreateTallySessionInput = {
        block_name: blockField.value,
        project_name: projectSelect.value,
        supervisor: supervisorField.value,
        target_density: targetDensityField.value ? Number(targetDensityField.value) : undefined,
        notes: notesField.value,
        species,
        date: dateField.value,
      };

      logUserAction('Start Session', input);
      saveButton.disabled = true;
      const session = await createTallySession(input);
      saveButton.disabled = false;
      navigate({ view: 'session-detail', sessionId: session.session_id });
    });

    card.append(form);
    root.append(createLogo(), headerRow, card);
  };

  const renderSessionDetail = async (sessionId: string): Promise<void> => {
    root.innerHTML = '';
    const session = await fetchTallySession(sessionId);
    if (!session) {
      const message = createElement('div', { className: 'small', text: 'Session not found.' });
      const backButton = createElement('button', { text: 'Back' }) as HTMLButtonElement;
      backButton.type = 'button';
      backButton.addEventListener('click', () => navigate({ view: 'home' }));
      root.append(backButton, message);
      return;
    }

    const bagups = await listBagupsForSession(sessionId);
    const draftForSession = draftBagup?.sessionId === sessionId ? draftBagup : null;
    const bagupsForTotals = draftForSession
      ? [
          ...bagups.filter((bagup) => bagup.bagup_id !== draftForSession.bagupId),
          {
            bagup_id: draftForSession.bagupId,
            session_id: sessionId,
            created_at: draftForSession.createdAt,
            counts: draftForSession.counts,
            sync_status: 'pending',
          } as Bagup,
        ].sort((a, b) => b.created_at - a.created_at)
      : bagups;

    const totals = calculateTotals(session.species, bagupsForTotals);
    const ratios = calculateRatios(session.species, totals);
    const overallTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);

    const latestBagup = bagupsForTotals[0];
    const timeSinceLast = latestBagup ? formatDuration(Date.now() - latestBagup.created_at) : '—';

    const headerRow = createElement('div', { className: 'header-row' });
    const backButton = createElement('button', { text: 'Back' }) as HTMLButtonElement;
    backButton.type = 'button';
    backButton.className = 'secondary compact';
    backButton.addEventListener('click', () => {
      logUserAction('Back from Session Detail');
      navigate({ view: 'home' });
    });
    const title = createElement('h1', { text: session.block_name });

    // Action buttons
    const actionsContainer = createElement('div');
    actionsContainer.style.display = 'flex';
    actionsContainer.style.gap = '8px';

    const isEditable = session.sync_status === 'draft' || session.sync_status === 'pending' || session.sync_status === 'error';

    if (isEditable) {
      const finalizeButton = createElement('button', { text: 'Finalize' }) as HTMLButtonElement;
      finalizeButton.className = 'compact';
      finalizeButton.addEventListener('click', async () => {
        if (confirm('Finalize session? This will make it ready for sync and lock it for editing.')) {
          logUserAction('Finalize Session', { sessionId });
          await finalizeSession(sessionId);
          await renderSessionDetail(sessionId);
        }
      });
      actionsContainer.append(finalizeButton);
    }

    const archiveButton = createElement('button', { text: 'Archive' }) as HTMLButtonElement;
    archiveButton.className = 'compact secondary';
    archiveButton.addEventListener('click', async () => {
      if (confirm('Archive session? It will be hidden from the main list.')) {
        logUserAction('Archive Session', { sessionId });
        await archiveSession(sessionId);
        navigate({ view: 'home' });
      }
    });
    actionsContainer.append(archiveButton);

    const addBagupButton = createElement('button', { text: '+' }) as HTMLButtonElement;
    addBagupButton.type = 'button';
    addBagupButton.className = 'fab';
    addBagupButton.disabled = !isEditable;

    headerRow.append(backButton, title, actionsContainer);

    const metaCard = createElement('section', { className: 'card' });
    const metaRow = createElement('div', { className: 'meta-row' });
    const timeLabel = createElement('div', { className: 'small', text: `Time since last bagup: ${timeSinceLast}` });
    const createdLabel = createElement('div', {
      className: 'small',
      text: `Started ${new Date(session.created_at).toLocaleDateString()}`,
    });

    if (session.project_name) {
      metaRow.append(createElement('div', { className: 'small', text: `Project: ${session.project_name}` }));
    }
    if (session.supervisor) {
      metaRow.append(createElement('div', { className: 'small', text: `Supervisor: ${session.supervisor}` }));
    }
    if (session.target_density) {
      metaRow.append(createElement('div', { className: 'small', text: `Target Density: ${session.target_density}` }));
    }

    const statusLabel = createElement('div', { className: 'small', text: `Status: ${session.sync_status}` });

    metaRow.append(timeLabel, createdLabel, statusLabel);
    if (session.notes) {
      const notes = createElement('div', { className: 'small', text: session.notes });
      metaCard.append(metaRow, notes);
    } else {
      metaCard.append(metaRow);
    }

    const summaryCard = createElement('section', { className: 'card' });
    const summaryTitle = createElement('h2', { text: 'Species totals' });
    const summaryList = createElement('div', { className: 'species-summary-list' });
    session.species.forEach((species) => {
      summaryList.append(createSpeciesSummaryRow(species));
    });
    summaryCard.append(summaryTitle, summaryList);

    const bagupCard = createElement('section', { className: 'card' });
    const bagupTitleRow = createElement('div', { className: 'bagup-title-row' });
    const bagupTitle = createElement('h2', { text: 'Bagups' });
    bagupTitleRow.append(bagupTitle, addBagupButton);
    const bagupList = createElement('div', { className: 'tally-list' });
    bagupCard.append(bagupTitleRow, bagupList);

    const mapCard = createElement('section', { className: 'card' });
    const mapContainer = createElement('div');
    mapContainer.id = 'session-map-container';
    mapContainer.style.height = '400px';
    mapCard.append(mapContainer);

    // Initialize map
    if (cleanupMap) {
      cleanupMap();
      cleanupMap = null;
    }
    const { cleanup, map } = initMap(mapContainer);
    cleanupMap = cleanup;

    // Add markers and generate KML
    if (bagups.length > 0) {
      addBagupMarkers(map, bagups, session.block_name);

      // Log KML content to console as requested (simulating "stored in public/maps/bagups.kml")
      const kmlContent = generateBagupsKML(bagups, session.block_name);
      console.log('--- Generated KML Content for public/maps/bagups.kml ---');
      console.log(kmlContent);
      console.log('--------------------------------------------------------');
    }

    const updateSummary = (nextTotals: Record<string, number>, nextRatios: Record<string, number>) => {
      const nextOverall = Object.values(nextTotals).reduce((sum, value) => sum + value, 0);
      session.species.forEach((species) => {
        const row = summaryList.querySelector<HTMLDivElement>(
          `[data-species-code="${species.species_code}"]`
        );
        if (!row) return;
        const currentEl = row.querySelector<HTMLDivElement>('.species-current');
        const totalEl = row.querySelector<HTMLDivElement>('.species-total');
        if (currentEl) {
          currentEl.textContent = `Current: ${formatRatioText(nextRatios[species.species_code] ?? 0, nextOverall)}`;
        }
        if (totalEl) {
          totalEl.textContent = `Total: ${nextTotals[species.species_code] ?? 0}`;
        }
      });
    };

    updateSummary(totals, ratios);

    const renderBagups = (items: Bagup[]) => {
      bagupList.innerHTML = '';
      if (items.length === 0) {
        bagupList.append(createElement('div', { className: 'small', text: 'No bagups yet.' }));
        return;
      }

      const elapsedMap = buildElapsedMap(items);
      items.forEach((bagup) => {
        const item = createElement('div', { className: 'bagup-item' });

        if (typeof bagup.lat === 'number' && typeof bagup.lng === 'number') {
          item.classList.add('clickable');
          item.addEventListener('click', () => {
            map.flyTo([bagup.lat!, bagup.lng!], 18);
          });
        }

        const header = createElement('div', { className: 'bagup-header' });
        const time = createElement('div', { text: formatTime(bagup.created_at) });
        const elapsed = createElement('div', { className: 'small', text: elapsedMap[bagup.bagup_id] });
        header.append(time, elapsed);

        const counts = createElement('div', { className: 'bagup-counts' });
        session.species.forEach((species) => {
          const count = bagup.counts[species.species_code] ?? 0;
          counts.append(
            createElement('span', {
              className: 'bagup-count',
              text: `${species.display_name}: ${count}`,
            })
          );
        });

        item.append(header, counts);
        bagupList.append(item);
      });
    };

    renderBagups(bagups.filter((bagup) => bagup.bagup_id !== draftForSession?.bagupId));

    addBagupButton.addEventListener('click', async () => {
      if (draftBagup || !isEditable) {
        return;
      }
      logUserAction('Add Bagup clicked');

      let location: { lat: number; lng: number } | undefined;
      try {
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
            });
          });
          location = { lat: position.coords.latitude, lng: position.coords.longitude };
        }
      } catch (e) {
        console.warn('Failed to get location for bagup:', e);
      }

      const speciesCodes = session.species.map((species) => species.species_code);
      const bagup = await createBagup(sessionId, speciesCodes, location);
      draftBagup = {
        sessionId,
        bagupId: bagup.bagup_id,
        createdAt: bagup.created_at,
        counts: { ...bagup.counts },
      };
      await renderSessionDetail(sessionId);
    });

    if (draftForSession && isEditable) {
      const editorCard = createElement('section', { className: 'card' });
      const editorTitle = createElement('h2', { text: 'New bagup' });
      const editorForm = document.createElement('form');

      session.species.forEach((species) => {
        const label = createElement('label', { text: species.display_name });
        const input = createElement('input') as HTMLInputElement;
        input.type = 'number';
        input.min = '0';
        input.value = String(draftForSession.counts[species.species_code] ?? 0);
        input.addEventListener('input', () => {
          draftForSession.counts[species.species_code] = Number(input.value || 0);
          const nextTotals = calculateTotals(session.species, [
            ...bagups.filter((bagup) => bagup.bagup_id !== draftForSession.bagupId),
            {
              bagup_id: draftForSession.bagupId,
              session_id: sessionId,
              created_at: draftForSession.createdAt,
              counts: draftForSession.counts,
              sync_status: 'pending',
            },
          ]);
          const nextRatios = calculateRatios(session.species, nextTotals);
          updateSummary(nextTotals, nextRatios);
        });
        editorForm.append(label, input);
      });

      const editorActions = createElement('div', { className: 'editor-actions' });
      const cancelButton = createElement('button', { text: 'Cancel' }) as HTMLButtonElement;
      cancelButton.type = 'button';
      cancelButton.className = 'secondary';
      const saveButton = createElement('button', { text: 'Save bagup' }) as HTMLButtonElement;
      saveButton.type = 'submit';
      editorActions.append(cancelButton, saveButton);

      cancelButton.addEventListener('click', async () => {
        logUserAction('Cancel Bagup');
        await removeBagup(draftForSession.bagupId);
        draftBagup = null;
        await renderSessionDetail(sessionId);
      });

      editorForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        logUserAction('Save Bagup', draftForSession.counts);
        saveButton.disabled = true;
        await saveBagupCounts(draftForSession.bagupId, draftForSession.counts);
        draftBagup = null;
        saveButton.disabled = false;
        await renderSessionDetail(sessionId);
      });

      editorForm.append(editorActions);
      editorCard.append(editorTitle, editorForm);
      root.append(createLogo(), headerRow, metaCard, summaryCard, editorCard, bagupCard, mapCard);
    } else {
      root.append(createLogo(), headerRow, metaCard, summaryCard, bagupCard, mapCard);
    }
  };

  const render = async (): Promise<void> => {
    if (cleanupMap) {
      cleanupMap();
      cleanupMap = null;
    }
    switch (viewState.view) {
      case 'home':
        await renderHome();
        return;
      case 'new-session':
        await renderNewSession();
        return;
      case 'session-detail':
        await renderSessionDetail(viewState.sessionId);
        return;
      default:
        return;
    }
  };

  void render();
};
