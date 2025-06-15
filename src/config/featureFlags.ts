
interface FeatureFlags {
  hesseInsights: boolean;
  // Add other feature flags here as needed
}

export const featureFlags: FeatureFlags = {
  hesseInsights: false, // Disabled by default as requested
};

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return featureFlags[feature];
};

// Function to toggle features (useful for development/testing)
export const toggleFeature = (feature: keyof FeatureFlags): void => {
  featureFlags[feature] = !featureFlags[feature];
  console.log(`Feature ${feature} is now ${featureFlags[feature] ? 'enabled' : 'disabled'}`);
};
