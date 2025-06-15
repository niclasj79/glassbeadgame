
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

// Convert screen coordinates to sphere coordinates
export const screenToSphere = (screenX: number, screenY: number, canvas: HTMLCanvasElement, rotationRef: React.MutableRefObject<{ x: number; y: number }>) => {
  const sphereRadius = 180;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Convert to normalized coordinates
  const normalizedX = (screenX - centerX) / (sphereRadius * 0.8);
  const normalizedY = (screenY - centerY) / (sphereRadius * 0.8);
  
  // Calculate Z coordinate to maintain sphere surface
  const distanceFromCenter = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
  
  let sphereX, sphereY, sphereZ;
  
  if (distanceFromCenter <= 1) {
    // Point is within sphere projection
    sphereX = normalizedX * sphereRadius;
    sphereY = normalizedY * sphereRadius;
    sphereZ = Math.sqrt(Math.max(0, sphereRadius * sphereRadius - sphereX * sphereX - sphereY * sphereY));
  } else {
    // Project point to sphere surface
    const scale = 1 / distanceFromCenter;
    sphereX = normalizedX * scale * sphereRadius;
    sphereY = normalizedY * scale * sphereRadius;
    sphereZ = 0;
  }
  
  // Apply inverse rotation to get world coordinates
  const inverseRotated = rotatePoint(sphereX, sphereY, sphereZ, -rotationRef.current.x, -rotationRef.current.y);
  
  return {
    x: inverseRotated.x,
    y: inverseRotated.y,
    z: inverseRotated.z
  };
};

// Calculate dimensional values based on position
export const calculateDimensionalValues = (x: number, y: number, z: number) => {
  const radius = Math.sqrt(x * x + y * y + z * z);
  const normalizedX = x / radius;
  const normalizedY = y / radius;
  const normalizedZ = z / radius;
  
  return {
    abstract_concrete: (normalizedZ + 1) / 2, // Z-axis: -1 (abstract) to 1 (concrete)
    theoretical_practical: (normalizedY + 1) / 2, // Y-axis: -1 (theoretical) to 1 (practical)
    analytical_intuitive: (normalizedX + 1) / 2, // X-axis: -1 (analytical) to 1 (intuitive)
  };
};

// Generate synthesis insight based on spatial relationships
export const generateSpatialSynthesis = (concept1: { text: string; x: number; y: number; z: number }, concept2: { text: string; x: number; y: number; z: number }) => {
  const distance = Math.sqrt(
    (concept1.x - concept2.x) ** 2 + 
    (concept1.y - concept2.y) ** 2 + 
    (concept1.z - concept2.z) ** 2
  );
  
  const values1 = calculateDimensionalValues(concept1.x, concept1.y, concept1.z);
  const values2 = calculateDimensionalValues(concept2.x, concept2.y, concept2.z);
  
  const proximityInsights = [
    "resonate through shared dimensional space",
    "create harmonic convergence in meaning",
    "bridge different ways of knowing",
    "synthesize through spatial relationship",
    "reveal hidden connections through positioning"
  ];
  
  const dimensionalInsights = [
    values1.abstract_concrete > 0.7 && values2.abstract_concrete > 0.7 ? "both grounded in concrete reality" : null,
    values1.abstract_concrete < 0.3 && values2.abstract_concrete < 0.3 ? "both exist in abstract realm" : null,
    values1.theoretical_practical > 0.7 && values2.theoretical_practical > 0.7 ? "both emphasize practical application" : null,
    values1.analytical_intuitive > 0.7 && values2.analytical_intuitive > 0.7 ? "both favor intuitive understanding" : null,
  ].filter(Boolean);
  
  if (distance < 60) {
    return `${concept1.text} and ${concept2.text} ${proximityInsights[Math.floor(Math.random() * proximityInsights.length)]}`;
  } else if (dimensionalInsights.length > 0) {
    return `${concept1.text} and ${concept2.text}: ${dimensionalInsights[0]}`;
  }
  
  return null;
};

export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
