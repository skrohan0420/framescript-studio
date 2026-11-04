export function renderStar(context, { glowIntensity }) {
  const { width, height } = context.canvas;
  const x = width / 2;
  const y = height / 2;
  context.fillStyle = "#080d20";
  context.fillRect(0, 0, width, height);
  const halo = context.createRadialGradient(x, y, 0, x, y, 100);
  halo.addColorStop(0, `rgba(128, 181, 255, ${glowIntensity})`);
  halo.addColorStop(1, "rgba(128, 181, 255, 0)");
  context.fillStyle = halo;
  context.fillRect(x - 100, y - 100, 200, 200);
  context.beginPath();
  context.arc(x, y, 10, 0, Math.PI * 2);
  context.fillStyle = "#eef5ff";
  context.fill();
}
