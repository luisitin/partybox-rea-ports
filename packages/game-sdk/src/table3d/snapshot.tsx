import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

/** The table's picture on request (T-0403): a WebGL canvas cloned with its screen (the shell's crossfade ghost) is blank,
 *  since the drawing buffer is cleared once presented. `canvas.pbSnapshot()` draws the scene once more and copies it to a
 *  2D canvas the ghost can show in the canvas's place. Not the post chain's look (a ghost lives about 0.35 s). */
export type TableSnapshot = () => HTMLCanvasElement | null;
export function Snapshot(): null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    const canvas = gl.domElement;
    const snapshot: TableSnapshot = () => {
      try {
        const copy = canvas.ownerDocument.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        gl.render(scene, camera);
        copy.getContext('2d')?.drawImage(canvas, 0, 0);
        return copy;
      } catch {
        return null;
      }
    };
    Object.defineProperty(canvas, 'pbSnapshot', { value: snapshot, configurable: true });
    return () => {
      Reflect.deleteProperty(canvas, 'pbSnapshot');
    };
  }, [gl, scene, camera]);
  return null;
}
