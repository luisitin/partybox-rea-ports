import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useDraft } from '@partybox/game-sdk/ui';
import { emptyGuessDraft, restoreGuessDraft, saveGuessDraft } from './guessDraft';

describe('refresh recovery outside a host draft scope', () => {
  it('uses the real SDK no-op slot safely without storage, leaking or replaying text', () => {
    function Preview() {
      const slot = useDraft('guess:player:1');
      slot.write(saveGuessDraft({ turn: 1, text: 'private guess', edit: 1 }));
      const restored = restoreGuessDraft(slot.read(), 1, { revision: 0, accepted: true });
      expect(restored).toEqual(emptyGuessDraft(1));
      slot.clear();
      return <span>{restored.text || 'Empty draft'}</span>;
    }
    expect(renderToStaticMarkup(<Preview />)).toBe('<span>Empty draft</span>');
  });
});
