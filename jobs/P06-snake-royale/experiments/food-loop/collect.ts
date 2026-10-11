// Reproduction collectors: frozen original and the current allocation-only optimization.
import { distance2, rounded } from '../../../../games/snake-royale/server/geometry';
import { MAX_MASS, RADIUS } from '../../../../games/snake-royale/server/types';
import type { Food, Snake } from '../../../../games/snake-royale/server/types';

export function collectFoodFast(snakes: Snake[], items: Food[]): Food[] {
  const food: Food[] = [];
  for (const f of items) {
    let nearest = Infinity,
      first = -1,
      tied: number[] | undefined;
    for (let i = 0; i < snakes.length; i++) {
      const s = snakes[i]!;
      if (s.respawnAt !== null) continue;
      const h = s.body[0]!;
      // Exactly distance2(head, [f.x, f.y]); retain subtraction, powers and addition order.
      const d = (h[0] - f.x) ** 2 + (h[1] - f.y) ** 2;
      if (d > (RADIUS + 1.2) ** 2) continue;
      if (d < nearest - 0.000001) {
        nearest = d;
        first = i;
        tied = undefined;
      } else if (Math.abs(d - nearest) < 0.000001) {
        if (tied) tied.push(i);
        else tied = [first, i];
      }
    }
    if (first === -1) food.push(f);
    else if (tied) {
      for (const i of tied) {
        const s = snakes[i]!;
        snakes[i] = { ...s, mass: rounded(Math.min(MAX_MASS, s.mass + f.value / tied.length)) };
      }
    } else {
      const s = snakes[first]!;
      snakes[first] = { ...s, mass: rounded(Math.min(MAX_MASS, s.mass + f.value)) };
    }
  }
  return food;
}

// Frozen pre-optimization comparison: ordering, epsilon checks and rounding stay exact.
export function collectFoodReference(snakes: Snake[], items: Food[]): Food[] {
  const food: Food[] = [];
  for (const f of items) {
    let nearest = Infinity;
    let eaters: number[] = [];
    snakes.forEach((s, i) => {
      if (s.respawnAt !== null) return;
      const d = distance2(s.body[0]!, [f.x, f.y]);
      if (d > (RADIUS + 1.2) ** 2) return;
      if (d < nearest - 0.000001) {
        nearest = d;
        eaters = [i];
      } else if (Math.abs(d - nearest) < 0.000001) eaters.push(i);
    });
    if (eaters.length === 0) food.push(f);
    else
      for (const i of eaters) {
        const s = snakes[i]!;
        snakes[i] = { ...s, mass: rounded(Math.min(MAX_MASS, s.mass + f.value / eaters.length)) };
      }
  }
  return food;
}

// Exact marker prevents the differential wrapper silently replacing a different rule.
export const ORIGINAL_FOOD_BLOCK = `  const food: Food[] = [];
  for (const f of world.food) {
    let nearest = Infinity;
    let eaters: number[] = [];
    snakes.forEach((s, i) => {
      if (s.respawnAt !== null) return;
      const d = distance2(s.body[0]!, [f.x, f.y]);
      if (d > (RADIUS + 1.2) ** 2) return;
      if (d < nearest - 0.000001) {
        nearest = d;
        eaters = [i];
      } else if (Math.abs(d - nearest) < 0.000001) eaters.push(i);
    });
    if (eaters.length === 0) food.push(f);
    else
      for (const i of eaters) {
        const s = snakes[i]!;
        snakes[i] = { ...s, mass: rounded(Math.min(MAX_MASS, s.mass + f.value / eaters.length)) };
      }
  }
`;

export const OPTIMIZED_FOOD_BLOCK = `  const food: Food[] = [];
  for (const f of world.food) {
    let nearest = Infinity,
      first = -1,
      tied: number[] | undefined;
    for (let i = 0; i < snakes.length; i++) {
      const s = snakes[i]!;
      if (s.respawnAt !== null) continue;
      const h = s.body[0]!;
      const d = (h[0] - f.x) ** 2 + (h[1] - f.y) ** 2;
      if (d > (RADIUS + 1.2) ** 2) continue;
      if (d < nearest - 0.000001) {
        nearest = d;
        first = i;
        tied = undefined;
      } else if (Math.abs(d - nearest) < 0.000001) {
        if (tied) tied.push(i);
        else tied = [first, i];
      }
    }
    if (first === -1) food.push(f);
    else if (tied) {
      for (const i of tied) {
        const s = snakes[i]!;
        snakes[i] = { ...s, mass: rounded(Math.min(MAX_MASS, s.mass + f.value / tied.length)) };
      }
    } else {
      const s = snakes[first]!;
      snakes[first] = { ...s, mass: rounded(Math.min(MAX_MASS, s.mass + f.value)) };
    }
  }
`;
