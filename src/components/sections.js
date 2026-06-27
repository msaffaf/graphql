/**
 * Static dashboard sections: profile card, summary metrics, attempted-projects
 * panel and the audit panel. Each takes the view-model and returns DOM.
 */

import { el, badge } from './dom.js';
import { buildAuditChart } from './charts.js';
import { formatXp, formatRatio } from '../utils.js';

/* ---- Expanded profile card (5 fields, multi-column grid) ---------------- */

export function renderProfileCard(profile) {
  const panel = el('section', { class: 'panel profile', 'aria-label': 'Profile details' });
  panel.append(el('h2', { class: 'panel__title', text: 'Profile' }));

  const grid = el('div', { class: 'profile__grid' });
  const fields = [
    ['Username', profile.login],
    ['Email', profile.email],
    ['Country', profile.country],
    ['CPR', profile.cpr],
    ['Degree', profile.degree],
  ];
  for (const [label, value] of fields) {
    grid.append(
      el('div', { class: 'profile__cell' }, [
        el('span', { class: 'profile__label', text: label }),
        el('span', { class: 'profile__value', text: value || '—' }),
      ])
    );
  }
  panel.append(grid);
  return panel;
}

/* ---- Three core summary metric cards ----------------------------------- */

export function renderMetrics(data) {
  const row = el('section', { class: 'metrics', 'aria-label': 'Summary metrics' });
  row.append(
    metricCard('Total XP', formatXp(data.totalXp), `${data.xpTransactions.length} transactions`),
    metricCard('Projects passed', String(data.totalPassed), `of ${data.totalAttempted} attempted`),
    metricCard(
      'Audit ratio',
      formatRatio(data.auditRatio),
      `${formatXp(data.auditUp)} up · ${formatXp(data.auditDown)} down`
    )
  );
  return row;
}

function metricCard(label, value, sub) {
  return el('article', { class: 'card metric' }, [
    el('p', { class: 'metric__label', text: label }),
    el('p', { class: 'metric__value', text: value }),
    el('p', { class: 'metric__sub', text: sub }),
  ]);
}

/* ---- Attempted projects: two badge counters + scrollable list ----------- */

export function renderProjectsPanel(data) {
  const panel = el('section', { class: 'panel projects', 'aria-label': 'Attempted projects' });

  const head = el('div', { class: 'panel__head' });
  head.append(el('h2', { class: 'panel__title', text: 'Attempted projects' }));
  head.append(
    el('div', { class: 'projects__badges' }, [
      counter('Attempted', data.totalAttempted, 'neutral'),
      counter('Passed', data.totalPassed, 'success'),
    ])
  );
  panel.append(head);

  const scroll = el('div', { class: 'projects__scroll' });
  const list = el('ul', { class: 'projects__list' });

  if (!data.attemptedProjects.length) {
    list.append(el('li', { class: 'projects__empty', text: 'No attempted projects yet' }));
  } else {
    for (const p of data.attemptedProjects) {
      list.append(
        el('li', { class: 'projects__item' }, [
          el('span', { class: 'projects__name', text: p.name, title: p.path || '' }),
          statusBadge(p.status),
        ])
      );
    }
  }
  scroll.append(list);
  panel.append(scroll);
  return panel;
}

function counter(label, value, kind) {
  return el('div', { class: `counter counter--${kind}` }, [
    el('span', { class: 'counter__value', text: String(value) }),
    el('span', { class: 'counter__label', text: label }),
  ]);
}

function statusBadge(status) {
  if (status === 'PASS') return badge('PASS', 'success');
  if (status === 'FAIL') return badge('FAIL', 'danger');
  return badge('IN_PROGRESS', 'progress');
}

/* ---- Audit done vs received panel --------------------------------------- */

export function renderAuditPanel(data) {
  const panel = el('section', { class: 'panel audit', 'aria-label': 'Audit ratio' });

  panel.append(
    el('div', { class: 'panel__head' }, [
      el('h2', { class: 'panel__title', text: 'Audits — done vs received' }),
    ])
  );

  panel.append(
    el('div', { class: 'audit__ratio' }, [
      el('span', { class: 'audit__ratio-value', text: formatRatio(data.auditRatio) }),
      el('span', { class: 'audit__ratio-label', text: 'audit ratio (up ÷ down)' }),
    ])
  );

  panel.append(el('div', { class: 'audit__chart' }, [buildAuditChart({ up: data.auditUp, down: data.auditDown })]));
  return panel;
}
