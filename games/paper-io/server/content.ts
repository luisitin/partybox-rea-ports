// Original spawn anchors, clockwise and separated at every supported roster size.
export const ANCHORS = [
  [5, 5],
  [34, 22],
  [34, 5],
  [5, 22],
  [19, 5],
  [19, 22],
  [5, 13],
  [34, 13],
] as const;

// Clockwise lanes keep both crowded eastern pairs from swapping heads at tick eight.
export const START_DIRECTIONS = [1, 3, 2, 0, 1, 3, 0, 2] as const;

// Corner vertical heads start inside their homes in parallel lanes to mid-side
// heads. Protected homes and later respawn centers stay unchanged.
export const OPENING_OFFSETS = [0, 0, -1, 1, 0, 0, 0, 0] as const;
