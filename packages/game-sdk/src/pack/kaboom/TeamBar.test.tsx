// T-0886: the team's meter says whose total it is. The phone shows your own points on the same screen, so the number carries a
// visible "Team:" label. The kit has no react-dom, so these read the element tree TeamBar returns (as Scene.test.tsx does).
import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TeamBarProps } from './TeamBar';
import { TeamBar } from './TeamBar';

// TeamBar's words come from useT: the English with its {placeholders} filled in. The Spanish is checked by scripts/i18n-coverage.test.ts.
vi.mock('../../ui/lang', () => ({
  useT: () =>
    Object.assign(
      (en: string, vars?: Readonly<Record<string, string | number>>) =>
        en.replace(/\{(\w+)\}/g, (_, key: string) => String(vars?.[key] ?? `{${key}}`)),
      { sent: (text: string) => text, lang: 'en' },
    ),
}));

type Props = Record<string, unknown> & { children?: ReactNode };

/** The text a returned tree shows, in order. */
function shown(node: ReactNode): string {
  let text = '';
  Children.forEach(node, (child) => {
    if (typeof child === 'string' || typeof child === 'number') text += child;
    else if (isValidElement<Props>(child)) text += shown(child.props.children);
  });
  return text;
}

function bar(over: Partial<TeamBarProps> = {}): ReactElement<Props> {
  const props: TeamBarProps = {
    team: 1,
    max: 8,
    cuts: [6, 4, 2],
    grade: 'C',
    unit: 'points',
    ...over,
  };
  return TeamBar(props) as ReactElement<Props>;
}

/** The visible number: the bar's last child, hidden from screen readers (the bar's aria-label says it instead). */
function numberOf(root: ReactElement<Props>): string {
  const parts = Children.toArray(root.props.children);
  return shown(parts[parts.length - 1]);
}

describe('TeamBar', () => {
  it("labels the number as the team's total, so your own points beside it are not read as one total", () => {
    expect(numberOf(bar())).toBe('Team: 1 points');
  });

  it("labels the TV's big bar the same way, whatever the unit", () => {
    const big = bar({
      big: true,
      team: 12,
      max: 40,
      cuts: [31, 23, 10],
      grade: 'A',
      unit: 'boxes',
    });
    expect(numberOf(big)).toBe('Team: 12 boxes');
  });

  it('keeps the sentence a screen reader hears', () => {
    expect(bar().props['aria-label']).toBe('Team score: 1 of 8 points. Rating C');
  });
});
