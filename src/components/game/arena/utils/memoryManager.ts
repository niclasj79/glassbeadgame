interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  componentCount: number;
  eventListeners: number;
  timestamp: number;
}

class MemoryManager {
  private static instance: MemoryManager;
  private metrics: MemoryMetrics[] = [];
  private maxMetricsHistory = 50;
  private cleanupTasks: Set<() => void> = new Set();
  private isMonitoring = false;
  private monitoringInterval?: number;

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics();
    }, 5000); // Collect metrics every 5 seconds
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }

  private collectMetrics(): void {
    const metric: MemoryMetrics = {
      heapUsed: (performance as any).memory?.usedJSHeapSize || 0,
      heapTotal: (performance as any).memory?.totalJSHeapSize || 0,
      componentCount: document.querySelectorAll('[data-component]').length,
      eventListeners: this.countEventListeners(),
      timestamp: Date.now()
    };

    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }

    // Check for memory leaks
    this.checkForLeaks();
  }

  private countEventListeners(): number {
    // Approximation - count elements with common event attributes
    return document.querySelectorAll('[onclick], [onmouseover], [ontouchstart]').length;
  }

  private checkForLeaks(): void {
    if (this.metrics.length < 5) return;

    const recent = this.metrics.slice(-5);
    const memoryGrowth = recent[recent.length - 1].heapUsed - recent[0].heapUsed;
    
    if (memoryGrowth > 50 * 1024 * 1024) { // 50MB growth in 5 measurements
      console.warn('Potential memory leak detected:', {
        growth: `${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
        currentHeap: `${(recent[recent.length - 1].heapUsed / 1024 / 1024).toFixed(2)}MB`
      });
    }
  }

  registerCleanupTask(task: () => void): void {
    this.cleanupTasks.add(task);
  }

  unregisterCleanupTask(task: () => void): void {
    this.cleanupTasks.delete(task);
  }

  cleanup(): void {
    this.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        console.warn('Cleanup task failed:', error);
      }
    });
    this.cleanupTasks.clear();
    this.stopMonitoring();
  }

  getMetrics(): MemoryMetrics[] {
    return [...this.metrics];
  }

  getCurrentMemoryUsage(): { used: string; total: string; percentage: number } {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) {
      return { used: '0MB', total: '0MB', percentage: 0 };
    }

    const usedMB = latest.heapUsed / 1024 / 1024;
    const totalMB = latest.heapTotal / 1024 / 1024;
    const percentage = (usedMB / totalMB) * 100;

    return {
      used: `${usedMB.toFixed(2)}MB`,
      total: `${totalMB.toFixed(2)}MB`,
      percentage: Math.round(percentage)
    };
  }
}

export const memoryManager = MemoryManager.getInstance();
