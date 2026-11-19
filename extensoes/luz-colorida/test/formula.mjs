// confere a fórmula do modo A com câmera, zoom e escala de tela (DPR) diferentes
for (const [zoom, tx, ty, dpr] of [[0.7, -150, 80, 1.25], [1.8, 400, -260, 1], [0.35, 20, 900, 2]]) {
  const pos = { x: 300, y: 200 }, W = 600;
  const P = { x: 500, y: 320 };
  const coord = { x: dpr * (zoom * P.x + tx), y: dpr * (zoom * P.y + ty) }; // pixel físico na tela
  const mv = { A: zoom, D: zoom, X: zoom * pos.x + tx, Y: zoom * pos.y + ty };  // local -> tela (CSS)
  const size = W * zoom * dpr;
  const r = size / (W * Math.abs(mv.A));
  const lc = { x: (coord.x / r - mv.X) / mv.A, y: (coord.y / r - mv.Y) / mv.D };
  const w = { x: lc.x + pos.x, y: lc.y + pos.y };
  console.log(`zoom ${zoom} dpr ${dpr}:`, w.x.toFixed(3), w.y.toFixed(3), '(esperado 500, 320)');
}
