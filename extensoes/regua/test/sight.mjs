import { checkTarget } from '../src/sight.js';
const d = 150;
const src = { x: 75, y: 75 };          // centro do quadrado (0,0)
const tgt = { x: 75 + 5 * d, y: 75 };  // 5 quadrados à direita
const show = (n, o) => console.log(n.padEnd(42), checkTarget(src, tgt, d, o).cover.label);
show('sem nada', { walls: [], partial: [], circles: [] });
show('parede inteira no meio', { walls: [{ a: { x: 450, y: -1000 }, b: { x: 450, y: 1000 } }], partial: [], circles: [] });
// parede que cobre só a metade de baixo do alvo (y > 75)
show('parede cobrindo metade de baixo', { walls: [{ a: { x: 600, y: 80 }, b: { x: 600, y: 600 } }], partial: [], circles: [] });
// parede que cobre 3 cantos
show('parede cobrindo 3 cantos', { walls: [{ a: { x: 700, y: -10 }, b: { x: 700, y: 600 } }], partial: [], circles: [] });
show('criatura no meio (50%)', { walls: [], partial: [], circles: [{ c: { x: 450, y: 75 }, r: 60, s: 0.5, id: 'x' }] });
show('parede encostada no canto do alvo', { walls: [{ a: { x: 750, y: 0 }, b: { x: 900, y: 0 } }], partial: [], circles: [] });
