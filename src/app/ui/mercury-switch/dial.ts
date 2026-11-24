export const DIAL = 172;
export const BEZEL = 184;
export const LAMP_Y = 133;
export const LENS = 13;
export const GLOW = 84;
const SCALE = { from: 50, to: 90, at: -127, per: 1.85, r: 152, minor: 5, major: 10, numerals: 129 };
export function printScale(size: number, dpr: number, cx: number, cy: number, font: string) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) throw new Error("Canvas 2D is unavailable");
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);
  g.scale(dpr, dpr);
  g.translate(cx, cy);
  g.fillStyle = g.strokeStyle = "#fff";
  g.lineCap = "butt";
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  for (let t = SCALE.from; t <= SCALE.to; t++) {
    const a = ((SCALE.at + (t - SCALE.from) * SCALE.per) * Math.PI) / 180;
    const five = t % 5 === 0;
    g.lineWidth = five ? 1.1 : 0.7;
    g.beginPath();
    g.moveTo(Math.cos(a) * SCALE.r, Math.sin(a) * SCALE.r);
    g.lineTo(Math.cos(a) * (SCALE.r - (five ? SCALE.major : SCALE.minor)), Math.sin(a) * (SCALE.r - (five ? SCALE.major : SCALE.minor)));
    g.stroke();
    if (t % 10 === 0) {
      g.save();
      g.rotate(a + Math.PI / 2);
      g.font = `500 13px ${font}`;
      g.fillText(String(t), 0, -SCALE.numerals + 4.6);
      g.restore();
    }
  }
  g.font = `500 9px ${font}`;
  g.fillText("°F", 0, -SCALE.numerals + 22);
  return c;
}
