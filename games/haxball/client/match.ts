import type { HaxballTvView } from '../server/index';

export type MatchView = Pick<
  HaxballTvView,
  | 'phaseId'
  | 'phaseAt'
  | 'deadline'
  | 'paused'
  | 'clockHeldAt'
  | 'half'
  | 'halfSeconds'
  | 'goals'
  | 'redAttacksRight'
  | 'ball'
  | 'discs'
  | 'lastGoal'
>;
export type Team = 'red' | 'blue';

export function teamName(team: Team): string {
  return team === 'red' ? 'Red' : 'Blue';
}
export function jersey(team: Team, number: number): string {
  return `${team === 'red' ? 'R' : 'B'}${number}`;
}
export function shortName(name: string, maximum = 20): string {
  const clean = name.trim() || 'Player';
  return clean.length > maximum ? `${clean.slice(0, maximum - 1)}…` : clean;
}
export function attackRight(view: MatchView, team: Team): boolean {
  return team === 'red' ? view.redAttacksRight : !view.redAttacksRight;
}
export function clockText(deadline: number | null, now: number): string {
  const seconds = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function matchHeadline(view: MatchView): string {
  if (view.paused) return 'Match paused';
  if (view.phaseId === 'goal' && view.lastGoal) return `${teamName(view.lastGoal.team)} goal!`;
  if (view.phaseId === 'halftime') return 'Half-time · switch ends';
  if (view.phaseId === 'done') {
    if (view.goals.red === view.goals.blue) return 'A draw!';
    return `${view.goals.red > view.goals.blue ? 'Red' : 'Blue'} wins!`;
  }
  return view.half === 1 ? 'First half' : 'Second half';
}
export function goalCredit(
  view: MatchView,
  style: 'named' | 'jersey' | 'accessible' = 'named',
): string {
  const goal = view.lastGoal;
  if (!goal) return '';
  const prefix = view.phaseId === 'goal' ? '' : 'Last goal: ';
  const scorer = view.discs.find((d) => d.id === goal.scorerId);
  if (!scorer) {
    const credit =
      style === 'jersey'
        ? `${teamName(goal.team)} · ${goal.ownGoal ? 'uncredited own goal' : 'no credited scorer'}`
        : `${teamName(goal.team)} goal · ${goal.ownGoal ? 'own goal, ' : ''}no credited scorer`;
    return `${prefix}${credit}`;
  }
  const number = jersey(scorer.team, scorer.number);
  if (style === 'jersey') return `${prefix}${goal.ownGoal ? `Own goal by ${number}` : number}`;
  const name = style === 'accessible' ? scorer.name.trim() || 'Player' : shortName(scorer.name, 24);
  const identity = `${number} · ${name}`;
  return `${prefix}${goal.ownGoal ? `Own goal by ${identity}` : `Scored by ${identity}`}`;
}
