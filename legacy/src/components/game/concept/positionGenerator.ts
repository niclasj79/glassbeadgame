
export class PositionGenerator {
  private static readonly SPHERE_RADIUS = 180;

  static generateSpherePosition() {
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.acos(2 * Math.random() - 1);
    
    const x = this.SPHERE_RADIUS * Math.sin(theta) * Math.cos(phi);
    const y = this.SPHERE_RADIUS * Math.sin(theta) * Math.sin(phi);
    const z = this.SPHERE_RADIUS * Math.cos(theta);

    return { x, y, z };
  }

  static generateEnergy(): number {
    return 0.3 + Math.random() * 0.7;
  }
}
