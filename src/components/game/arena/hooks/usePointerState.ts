
import { useRef } from 'react';
import { MouseRef } from '../types';

export const usePointerState = () => {
  const mouseRef = useRef<MouseRef>({ x: 0, y: 0, isDown: false });
  
  return { mouseRef };
};
