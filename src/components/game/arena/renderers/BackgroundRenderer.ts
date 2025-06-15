
export class BackgroundRenderer {
  static render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    // Create a more ethereal background with subtle gradient
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 2
    );
    gradient.addColorStop(0, 'rgba(5, 5, 25, 0.95)');
    gradient.addColorStop(0.5, 'rgba(10, 5, 35, 0.9)');
    gradient.addColorStop(1, 'rgba(0, 0, 15, 1)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
