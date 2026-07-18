/**
 * Interactive XP panel.
 *
 * Owns local UI state (the selected activity path) and, on every change,
 * recomputes the filtered subset and updates TWO linked views in place:
 *   1. the SVG line chart (rebuilt from the filtered cumulative series),
 *   2. the last-10 transaction ledger.
 */

import { el } from './dom.js';
import { buildXpLineChart } from './charts.js';
import { formatXp, formatDay, cumulativeSeries, activityName } from '../utils.js';

/**
 * @param {{ xpTransactions: Array, activities: Array<string> }} data
 * @returns {HTMLElement}
 */
export function renderXpSection(data) {
  const xpTx = data.xpTransactions || [];
  const activities = data.activities || [];
  const panel = el('section', { class: 'panel xp', 'aria-label': 'XP over time' });

  // --- Header: title + dynamic activity filter ---
  const head = el('div', { class: 'panel__head' });
  head.append(el('h2', { class: 'panel__title', text: 'XP over time' }));

  const select = el('select', {
    class: 'select',
    'aria-label': 'Filter XP by activity',
  });
  select.append(el('option', { value: 'all', text: 'All activity' }));
  for (const a of activities) select.append(el('option', { value: a, text: a }));
  head.append(select);
  panel.append(head);

  // --- XP amount for the chosen activity (#6) ---
  const total = el('div', { class: 'xp__total' });
  panel.append(total);

  // --- Body: chart + ledger, each a labelled column so the two boxes start
  //     at the same top edge and share the row height. ---
  const body = el('div', { class: 'xp__body' });

  const chartCol = el('div', { class: 'xp__col' });
  chartCol.append(el('h3', { class: 'xp__col-title', text: 'Cumulative XP' }));
  const chartWrap = el('div', { class: 'xp__chart' });
  chartCol.append(chartWrap);

  const ledgerCol = el('div', { class: 'xp__col' });
  ledgerCol.append(el('h3', { class: 'xp__col-title', text: 'Recent activity' }));
  const ledgerWrap = el('div', { class: 'xp__ledger' });
  ledgerCol.append(ledgerWrap);

  body.append(chartCol, ledgerCol);
  panel.append(body);

  /** Recompute the XP figure + chart + ledger for the chosen activity. */
  function apply(selected) {
    const filtered =
      (selected === 'all' ? xpTx : xpTx.filter((t) => activityName(t.path) === selected));
    // XP amount for the current selection.
    const sum = filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    total.replaceChildren(
      el('span', { class: 'xp__total-value', text: formatXp(sum) }),
      el('span', { class: 'xp__total-sub', text: selected === 'all' ? 'all activities' : selected })
    );

    // Recompute the chronological running total from the filtered subset and
    // rebuild the chart (its scales/viewBox adapt to the new data volume).
    chartWrap.replaceChildren(buildXpLineChart(cumulativeSeries(filtered)));
    ledgerWrap.replaceChildren(buildLedger(filtered));
  }

  select.addEventListener('change', () => apply(select.value));
  apply('all');

  return panel;
}

/* ------------------------------------------------------------------------ *
 * Recent activity ledger (last 10, newest first)
 * ------------------------------------------------------------------------ */

function buildLedger(transactions) {
  const recent = transactions
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  const scroll = el('div', { class: 'ledger__scroll' });
  const table = el('table', { class: 'ledger__table' });

  const thead = el('thead');
  const headRow = el('tr');
  ['Amount', 'Date', 'Project'].forEach((h) => headRow.append(el('th', { text: h })));
  thead.append(headRow);
  table.append(thead);

  const tbody = el('tbody');
  if (!recent.length) {
    const tr = el('tr');
    tr.append(el('td', { class: 'ledger__empty', text: 'No transactions', attrs: { colspan: '3' } }));
    tbody.append(tr);
  } else {
    for (const t of recent) {
      const tr = el('tr');
      let name = t.path.split('/').filter(Boolean).at(-1) || '—'
      tr.append(
        el('td', { class: 'ledger__amount', text: '+' + formatXp(Number(t.amount) || 0) }),
        el('td', { class: 'ledger__date', text: formatDay(new Date(t.createdAt)) }),
        el('td', { class: 'ledger__name', text: name, title: name })
      );
      tbody.append(tr);
    }
  }
  table.append(tbody);
  scroll.append(table);
  return scroll;
}
