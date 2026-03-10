
// Helper function to convert hex color to RGB
export const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// Pre-calculated constants for performance
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;

// Project 3D point to 2D canvas with stronger perspective
export const project3DTo2D = (x: number, y: number, z: number, canvas: HTMLCanvasElement) => {
  const distance = 300; // Closer camera = stronger perspective
  const scale = distance / (distance + z);
  return {
    x: (x * scale) + canvas.width * 0.5,
    y: (y * scale) + canvas.height * 0.5,
    scale
  };
};

// Optimized rotation with pre-calculated trigonometry
const rotationCache = new Map<string, { cos: number; sin: number }>();

const getTrigValues = (angle: number) => {
  const key = Math.round(angle * 1000).toString(); // Cache to 3 decimal places
  let cached = rotationCache.get(key);
  
  if (!cached) {
    cached = { cos: Math.cos(angle), sin: Math.sin(angle) };
    rotationCache.set(key, cached);
    
    // Limit cache size
    if (rotationCache.size > 100) {
      const firstKey = rotationCache.keys().next().value;
      rotationCache.delete(firstKey);
    }
  }
  
  return cached;
};

// Rotate point around origin with cached trigonometry
export const rotatePoint = (x: number, y: number, z: number, rotX: number, rotY: number) => {
  // Rotate around Y axis
  const yTrig = getTrigValues(rotY);
  const newX = x * yTrig.cos - z * yTrig.sin;
  const newZ = x * yTrig.sin + z * yTrig.cos;
  
  // Rotate around X axis
  const xTrig = getTrigValues(rotX);
  const newY = y * xTrig.cos - newZ * xTrig.sin;
  const finalZ = y * xTrig.sin + newZ * xTrig.cos;
  
  return { x: newX, y: newY, z: finalZ };
};

// Optimized screen to XY conversion for touch dragging
export const screenToXY = (screenX: number, screenY: number, canvas: HTMLCanvasElement, rotationRef: React.MutableRefObject<{ x: number; y: number }>) => {
  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.5;
  
  // Convert to normalized coordinates relative to canvas center
  const normalizedX = (screenX - centerX) * 0.8;
  const normalizedY = (screenY - centerY) * 0.8;
  
  return {
    x: normalizedX,
    y: normalizedY
  };
};

// Check if touch is near a concept (optimized for mobile)
export const isTouchNearConcept = (touchX: number, touchY: number, concept: any, canvas: HTMLCanvasElement, rotationRef: React.MutableRefObject<{ x: number; y: number }>) => {
  const rotated = rotatePoint(concept.x, concept.y, concept.z, rotationRef.current.x, rotationRef.current.y);
  const projected = project3DTo2D(rotated.x, rotated.y, rotated.z, canvas);
  
  const distance = Math.sqrt((touchX - projected.x) ** 2 + (touchY - projected.y) ** 2);
  const size = 8 + concept.energy * 4 * projected.scale;
  
  return distance < size + 15; // Slightly larger touch target
};

// Calculate distance between two touches
export const getTouchDistance = (touch1: { x: number; y: number }, touch2: { x: number; y: number }) => {
  const dx = touch1.x - touch2.x;
  const dy = touch1.y - touch2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Calculate center point between two touches
export const getTouchCenter = (touch1: { x: number; y: number }, touch2: { x: number; y: number }) => {
  return {
    x: (touch1.x + touch2.x) * 0.5,
    y: (touch1.y + touch2.y) * 0.5
  };
};

// Optimized screen to sphere conversion with early returns
export const screenToSphere = (screenX: number, screenY: number, canvas: HTMLCanvasElement, rotationRef: React.MutableRefObject<{ x: number; y: number }>) => {
  const sphereRadius = 180;
  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.5;
  const radiusScale = sphereRadius * 0.8;
  
  // Convert to normalized coordinates
  const normalizedX = (screenX - centerX) / radiusScale;
  const normalizedY = (screenY - centerY) / radiusScale;
  
  // Calculate Z coordinate to maintain sphere surface
  const distanceFromCenterSquared = normalizedX * normalizedX + normalizedY * normalizedY;
  
  let sphereX, sphereY, sphereZ;
  
  if (distanceFromCenterSquared <= 1) {
    // Point is within sphere projection
    sphereX = normalizedX * sphereRadius;
    sphereY = normalizedY * sphereRadius;
    sphereZ = Math.sqrt(Math.max(0, sphereRadius * sphereRadius - sphereX * sphereX - sphereY * sphereY));
  } else {
    // Project point to sphere surface
    const scale = 1 / Math.sqrt(distanceFromCenterSquared);
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

// Pre-calculated inverse for normalization
const RADIUS_INVERSE_CACHE = new Map<number, number>();

const getRadiusInverse = (radius: number) => {
  const key = Math.round(radius * 100);
  let inverse = RADIUS_INVERSE_CACHE.get(key);
  
  if (inverse === undefined) {
    inverse = 1 / radius;
    RADIUS_INVERSE_CACHE.set(key, inverse);
    
    if (RADIUS_INVERSE_CACHE.size > 50) {
      const firstKey = RADIUS_INVERSE_CACHE.keys().next().value;
      RADIUS_INVERSE_CACHE.delete(firstKey);
    }
  }
  
  return inverse;
};

// Optimized dimensional values calculation
export const calculateDimensionalValues = (x: number, y: number, z: number) => {
  const radiusSquared = x * x + y * y + z * z;
  
  if (radiusSquared === 0) {
    return {
      abstract_concrete: 0.5,
      theoretical_practical: 0.5,
      analytical_intuitive: 0.5
    };
  }
  
  const radius = Math.sqrt(radiusSquared);
  const radiusInverse = getRadiusInverse(radius);
  
  return {
    abstract_concrete: (z * radiusInverse + 1) * 0.5, // Z-axis: -1 (abstract) to 1 (concrete)
    theoretical_practical: (y * radiusInverse + 1) * 0.5, // Y-axis: -1 (theoretical) to 1 (practical)
    analytical_intuitive: (x * radiusInverse + 1) * 0.5, // X-axis: -1 (analytical) to 1 (intuitive)
  };
};

// Optimized spatial synthesis with distance caching
export const generateSpatialSynthesis = (concept1: { text: string; x: number; y: number; z: number }, concept2: { text: string; x: number; y: number; z: number }) => {
  const dx = concept1.x - concept2.x;
  const dy = concept1.y - concept2.y;
  const dz = concept1.z - concept2.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
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
