import { createElement } from '../../ui/dom';
import type { SpeciesRequirement } from './types';

export const createSpeciesEditorRow = (options: {
  initial?: Partial<SpeciesRequirement>;
}): {
  row: HTMLDivElement;
  codeInput: HTMLInputElement;
  nameInput: HTMLInputElement;
  ratioInput: HTMLInputElement;
} => {
  const row = createElement('div', { className: 'species-row' });
  const codeInput = createElement('input') as HTMLInputElement;
  codeInput.placeholder = 'Code';
  codeInput.readOnly = true;
  codeInput.value = options.initial?.species_code ?? '';

  const nameInput = createElement('input') as HTMLInputElement;
  nameInput.placeholder = 'Display name';
  nameInput.readOnly = true;
  nameInput.value = options.initial?.display_name ?? '';

  const ratioInput = createElement('input') as HTMLInputElement;
  ratioInput.type = 'number';
  ratioInput.step = '0.01';
  ratioInput.min = '0';
  ratioInput.placeholder = 'Required ratio';
  ratioInput.value = options.initial?.required_ratio?.toString() ?? '';

  row.append(codeInput, nameInput, ratioInput);

  return { row, codeInput, nameInput, ratioInput };
};

export const createSpeciesSummaryRow = (species: SpeciesRequirement): HTMLDivElement => {
  const row = createElement('div', { className: 'species-summary' });
  row.dataset.speciesCode = species.species_code;

  const title = createElement('div', { className: 'species-title', text: species.display_name });
  const required = createElement('div', {
    className: 'species-meta',
    text: `Target: ${(species.required_ratio * 100).toFixed(0)}%`,
  });
  const current = createElement('div', { className: 'species-current', text: 'Current: 0%' });
  const total = createElement('div', { className: 'species-total', text: 'Total: 0' });

  row.append(title, required, current, total);
  return row;
};
