
// Helper function to convert hex color to RGB
export const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// Project 3D point to 2D canvas
export const project3DTo2D = (x: number, y: number, z: number, canvas: HTMLCanvasElement) => {
  const distance = 400;
  const scale = distance / (distance + z);
  return {
    x: (x * scale) + canvas.width / 2,
    y: (y * scale) + canvas.height / 2,
    scale
  };
};

// Rotate point around origin
export const rotatePoint = (x: number, y: number, z: number, rotX: number, rotY: number) => {
  // Rotate around Y axis
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const newX = x * cosY - z * sinY;
  const newZ = x * sinY + z * cosY;
  
  // Rotate around X axis
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const newY = y * cosX - newZ * sinX;
  const finalZ = y * sinX + newZ * cosX;
  
  return { x: newX, y: newY, z: finalZ };
};

export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
