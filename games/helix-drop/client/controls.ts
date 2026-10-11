// Two simultaneous holds cancel; a release always stops its own side.
export const directionOf = (left: boolean, right: boolean): -1 | 0 | 1 =>
  left === right ? 0 : left ? -1 : 1;
