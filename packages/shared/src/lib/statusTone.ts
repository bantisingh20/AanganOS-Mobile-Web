/**
 * One colour rule for every status badge in both apps (tickets, bills, KYC, visitors, parcels, SOS,
 * units, notifications…). Matches on the meaning of the word, so 'InProgress', 'in_progress' and
 * 'In Progress' all get the same tone. Use with <Badge tone={statusTone(x)}>.
 */
export type StatusTone = 'default' | 'success' | 'warning' | 'danger' | 'muted' | 'info';

const RULES: [RegExp, StatusTone][] = [
  [/(reject|cancel|fail|denied|overdue|blocked|banned|suspend|expired|revoked|lost|damaged|emergency|critical|urgent|error|unpaid|due)/, 'danger'],
  [/(paid|resolved|complet|done|verified|approved|active|delivered|collected|success|sent|live|inside|entered|checkedin|handedover|occupied|available)/, 'success'],
  [/(pending|progress|partial|hold|waiting|review|draft|scheduled|queued|processing|acknowledged|received|high|medium)/, 'warning'],
  [/(closed|waived|inactive|hidden|left|exited|checkedout|returned|used|archived|low|vacant|none)/, 'muted'],
  [/(new|open|info|invited|upcoming)/, 'info'],
];

export function statusTone(status?: string | null): StatusTone {
  const s = (status ?? '').toLowerCase().replace(/[\s_-]/g, '');
  if (!s) return 'default';
  // Words that contain a "success" word but aren't successes ('unpaid' already hits the danger rule first).
  if (s.includes('inactive')) return 'muted';
  if (s.includes('partial')) return 'warning';
  for (const [re, tone] of RULES) if (re.test(s)) return tone;
  return 'default';
}

/** Dot colour for priority markers (high/urgent red, medium amber, low grey). */
export function priorityDotClass(priority?: string | null): string {
  const tone = statusTone(priority);
  if (tone === 'danger') return 'bg-rose-500';
  if (tone === 'warning') return (priority ?? '').toLowerCase().includes('high') ? 'bg-rose-500' : 'bg-amber-400';
  return 'bg-slate-400';
}
