// Event-driven heading input. Releases never wait for a timer or the next server snapshot.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import type { Input } from '../server/types';
import { keyboardHeading, pointerHeading } from './timing';

interface Options {
  angle: number;
  enabled: boolean;
  canBoost: boolean;
  send: (input: Input) => void;
  compass: RefObject<SVGSVGElement | null>;
}

interface PointerHandlers {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
  onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLButtonElement>) => void;
}

interface SteeringControls {
  angle: number;
  boosting: boolean;
  release: () => void;
  blurBoost: () => void;
  boostKey: (down: boolean, key: string) => void;
  steerHandlers: PointerHandlers;
  boostHandlers: PointerHandlers;
}

const DIRECTIONS: Readonly<Record<string, string>> = {
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
};

export function useSteering({
  angle,
  enabled,
  canBoost,
  send,
  compass,
}: Options): SteeringControls {
  const [display, setDisplay] = useState({ angle, boost: false });
  const latest = useRef({ angle, enabled, canBoost, send });
  latest.current = { angle, enabled, canBoost, send };
  const input = useRef({
    angle,
    boost: false,
    steerPointer: null as number | null,
    boostPointer: null as number | null,
    keyboardBoost: false,
    keys: new Set<string>(),
    boostKeys: new Set<string>(),
  });

  const emit = useCallback((heading: number, boost: boolean): void => {
    const state = input.current;
    const requestedBoost = boost && latest.current.canBoost;
    if (state.angle === heading && state.boost === requestedBoost) return;
    state.angle = heading;
    state.boost = requestedBoost;
    setDisplay({ angle: heading, boost: requestedBoost });
    if (latest.current.enabled)
      latest.current.send({ type: 'steer', angle: heading, boost: requestedBoost });
  }, []);

  const release = useCallback((): void => {
    const state = input.current;
    const wasBoosting = state.boost;
    state.steerPointer = null;
    state.boostPointer = null;
    state.keyboardBoost = false;
    state.keys.clear();
    state.boostKeys.clear();
    state.boost = false;
    setDisplay((shown) => (shown.boost ? { ...shown, boost: false } : shown));
    if (wasBoosting) latest.current.send({ type: 'steer', angle: state.angle, boost: false });
  }, []);

  useEffect(() => {
    if (!enabled) release();
    else {
      input.current.angle = latest.current.angle;
      setDisplay({ angle: latest.current.angle, boost: false });
    }
    return release;
  }, [enabled, release]);

  useEffect(() => {
    if (!canBoost) {
      input.current.boostPointer = null;
      input.current.boostKeys.clear();
      input.current.keyboardBoost = false;
      emit(input.current.angle, false);
    }
  }, [canBoost, emit]);

  useEffect(() => {
    if (!enabled) return;
    const key =
      (down: boolean) =>
      (event: KeyboardEvent): void => {
        const name = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        // A release belongs to the physical key already held, even after focus or modifiers change.
        const trackedRelease =
          !down && (input.current.keys.has(name) || input.current.boostKeys.has(event.code));
        if (!trackedRelease && (event.altKey || event.ctrlKey || event.metaKey)) return;
        const target = event.target;
        if (
          !trackedRelease &&
          target instanceof HTMLElement &&
          (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
        )
          return;
        const direction = DIRECTIONS[name];
        if (direction) {
          event.preventDefault();
          if (down) input.current.keys.add(name);
          else input.current.keys.delete(name);
          const directions = new Set([...input.current.keys].map((held) => DIRECTIONS[held] ?? ''));
          emit(keyboardHeading(directions) ?? input.current.angle, input.current.boost);
        } else if (
          event.code === 'Space' ||
          name === 'Shift' ||
          (!down && input.current.boostKeys.has(event.code))
        ) {
          event.preventDefault();
          if (down) input.current.boostKeys.add(event.code);
          else input.current.boostKeys.delete(event.code);
          input.current.keyboardBoost = input.current.boostKeys.size > 0;
          emit(
            input.current.angle,
            input.current.keyboardBoost || input.current.boostPointer !== null,
          );
        }
      };
    const down = key(true);
    const up = key(false);
    const visibility = (): void => {
      if (document.hidden) release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', visibility);
      release();
    };
  }, [enabled, emit, release]);

  const steer = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!latest.current.enabled || input.current.steerPointer !== event.pointerId) return;
    const svg = compass.current;
    const matrix = svg?.getScreenCTM();
    let heading: number | null;
    if (svg && matrix) {
      // SVG coordinates account for its label offset and any preserveAspectRatio letterboxing.
      const screenPoint = svg.createSVGPoint();
      screenPoint.x = event.clientX;
      screenPoint.y = event.clientY;
      const local = screenPoint.matrixTransform(matrix.inverse());
      heading = pointerHeading(local.x, local.y, 100, 100);
    } else {
      const bounds = event.currentTarget.getBoundingClientRect();
      heading = pointerHeading(
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        bounds.width,
        bounds.height,
      );
    }
    if (heading !== null) emit(Math.round(heading * 100) / 100, input.current.boost);
  };
  const boostKey = (down: boolean, key: string): void => {
    if (!latest.current.enabled) return;
    if (down) input.current.boostKeys.add(key);
    else input.current.boostKeys.delete(key);
    input.current.keyboardBoost = input.current.boostKeys.size > 0;
    emit(input.current.angle, input.current.keyboardBoost || input.current.boostPointer !== null);
  };
  return {
    angle: display.angle,
    boosting: display.boost && enabled && canBoost,
    release,
    // Moving focus to the other thumb target must not release a captured boost pointer.
    blurBoost: (): void => {
      input.current.boostKeys.clear();
      input.current.keyboardBoost = false;
      emit(input.current.angle, input.current.boostPointer !== null);
    },
    boostKey,
    steerHandlers: {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>): void => {
        if (!enabled || event.button !== 0 || input.current.steerPointer !== null) return;
        input.current.steerPointer = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        steer(event);
      },
      onPointerMove: steer,
      onPointerUp: (event: PointerEvent<HTMLButtonElement>): void => {
        if (input.current.steerPointer === event.pointerId) input.current.steerPointer = null;
      },
      onPointerCancel: release,
      onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>): void => {
        if (input.current.steerPointer === event.pointerId) release();
      },
    },
    boostHandlers: {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>): void => {
        if (!enabled || !canBoost || event.button !== 0 || input.current.boostPointer !== null)
          return;
        input.current.boostPointer = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        emit(input.current.angle, true);
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>): void => {
        if (input.current.boostPointer !== event.pointerId) return;
        input.current.boostPointer = null;
        emit(input.current.angle, input.current.keyboardBoost);
      },
      onPointerCancel: release,
      onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>): void => {
        if (input.current.boostPointer === event.pointerId) release();
      },
    },
  };
}
