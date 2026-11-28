import { zoneShape, evaluate } from '../src/engine.js';
const d = 150;
const rect = (id, x, y, w, h) => ({ id, type: 'SHAPE', shapeType: 'RECTANGLE', position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, width: w, height: h });
const zones = new Map([['trap', zoneShape(rect('trap', 300, 0, 150, 150))], ['p1', zoneShape(rect('p1', 0, 600, 150, 150))], ['p2', zoneShape(rect('p2', 600, 600, 150, 150))]]);
const tok = (id, x, y) => ({ id, position: { x, y } });
const ok = (n, v, e) => console.log((v === e ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + v);
// atravessar a armadilha sem parar nela (75 -> 675 na mesma linha)
let r = evaluate({ zones: ['trap'], cause: 'enter' }, [{ token: tok('a', 675, 75), from: { x: 75, y: 75 }, to: { x: 675, y: 75 } }], [], zones, {}, d);
ok('passar por cima dispara', r.fire, true); ok('ponto de entrada x=300', Math.round(r.at.x), 300);
r = evaluate({ zones: ['trap'], cause: 'enter' }, [{ token: tok('a', 75, 375), from: { x: 75, y: 75 }, to: { x: 75, y: 375 } }], [], zones, {}, d);
ok('caminho longe não dispara', r.fire, false);
r = evaluate({ zones: ['trap'], cause: 'leave' }, [{ token: tok('a', 75, 75), from: { x: 375, y: 75 }, to: { x: 75, y: 75 } }], [], zones, {}, d);
ok('sair dispara', r.fire, true);
// duas placas
const st = {};
r = evaluate({ zones: ['p1', 'p2'], cause: 'standAll' }, [{ token: tok('a', 75, 675) }], [tok('a', 75, 675), tok('b', 75, 75)], zones, st, d);
ok('uma placa só não dispara', r.fire, false);
r = evaluate({ zones: ['p1', 'p2'], cause: 'standAll' }, [{ token: tok('b', 675, 675) }], [tok('a', 75, 675), tok('b', 675, 675)], zones, st, d);
ok('as duas placas disparam', r.fire, true);
r = evaluate({ zones: ['p1', 'p2'], cause: 'standAll' }, [{ token: tok('b', 680, 675) }], [tok('a', 75, 675), tok('b', 680, 675)], zones, st, d);
ok('continuar em cima não repete', r.fire, false);
r = evaluate({ zones: ['trap'], cause: 'near', radius: 2 }, [{ token: tok('a', 375, 375), from: { x: 375, y: 900 }, to: { x: 375, y: 375 } }], [], zones, {}, d);
ok('aproximar (2 quadrados) dispara', r.fire, true);
// fio (linha) cruzado
const wire = new Map([['w', zoneShape({ type: 'LINE', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, startPosition: { x: 450, y: 0 }, endPosition: { x: 450, y: 900 } })]]);
r = evaluate({ zones: ['w'], cause: 'enter' }, [{ token: tok('a', 600, 300), from: { x: 300, y: 300 }, to: { x: 600, y: 300 } }], [], wire, {}, d);
ok('fio cruzado dispara', r.fire, true);
// caminho da Régua em L passando pela armadilha (300..450, 0..150) e parada em cima dela
import { haltPoint, routeFromPlan } from '../src/engine.js';
const plan = [{ x: 75, y: 375 }, { x: 375, y: 375 }, { x: 375, y: -225 }, { x: 75, y: -225 }];
r = evaluate({ zones: ['trap'], cause: 'enter' }, [{ token: tok('a', 75, -225), from: plan[0], to: plan[3], route: plan }], [], zones, {}, d);
ok('rota em L dispara', r.fire, true); ok('trecho da entrada = 2', r.seg, 2);
ok('reta sem rota não pegaria', evaluate({ zones: ['trap'], cause: 'enter' }, [{ token: tok('a', 75, -225), from: plan[0], to: plan[3] }], [], zones, {}, d).fire, false);
let hp = haltPoint(r, d, true); ok('para em cima: centro da casa da armadilha', `${hp.x},${hp.y}`, '375,75');
ok('rota a partir do plano (lote)', JSON.stringify(routeFromPlan(plan, plan[0], plan[3])), JSON.stringify(plan));
ok('rota até ponto no meio do trecho', routeFromPlan(plan, plan[1], { x: 375, y: 75 }).length, 2);
ok('movimento fora do plano', routeFromPlan(plan, { x: 1, y: 1 }, plan[3]), null);
r = evaluate({ zones: ['w'], cause: 'enter' }, [{ token: tok('a', 675, 300), from: { x: 375, y: 300 }, to: { x: 675, y: 300 } }], [], wire, {}, d);
hp = haltPoint(r, d, true); ok('fio: para logo depois da linha', `${hp.x},${hp.y}`, '525,300');
// chegar perto passando ao lado (sem parar perto) e ponto onde entrou no raio
import { circleEntry, formation } from '../src/engine.js';
r = evaluate({ zones: ['trap'], cause: 'near', radius: 2.5 }, [{ token: tok('a', 975, 375), from: { x: -225, y: 375 }, to: { x: 975, y: 375 } }], [], zones, {}, d);
ok('passar perto (sem parar) dispara', r.fire, true); ok('entrou no raio em x=150', Math.round(r.at.x), 150);
ok('reta que não passa perto', circleEntry({ x: 0, y: 900 }, { x: 900, y: 900 }, { x: 375, y: 75 }, 300), null);
// formação: dois tokens lado a lado vão juntos, sem sair do grid
const f = formation([{ id: 'a', position: { x: 375, y: 75 } }, { id: 'b', position: { x: 525, y: 75 } }], { x: 1575, y: 975 });
ok('formação: um no destino', JSON.stringify(f.get('a')), '{"x":1575,"y":975}'); ok('formação: o outro ao lado', JSON.stringify(f.get('b')), '{"x":1725,"y":975}');
// placas: quem está em cima
const st2 = {};
r = evaluate({ zones: ['p1', 'p2'], cause: 'standAll' }, [{ token: tok('b', 675, 675) }], [tok('a', 75, 675), tok('b', 675, 675), tok('c', 75, 75)], zones, st2, d);
ok('placas: quem ativou = os que estão em cima', JSON.stringify(r.on), '["a","b"]');
// interagir: alcance até a alavanca (quadrado 300..450, 0..150)
import { pickReacher, distToShape } from '../src/engine.js';
const lev = zones.get('trap');
ok('encostado (lado) alcança 1', pickReacher([tok('a', 225, 75)], lev, 1, d).ok, true);
ok('encostado (diagonal) alcança 1', pickReacher([tok('a', 225, 225)], lev, 1, d).ok, true);
ok('2 quadrados não alcança 1', pickReacher([tok('a', 75, 75)], lev, 1, d).ok, false);
ok('2 quadrados alcança 2', pickReacher([tok('a', 75, 75)], lev, 2, d).ok, true);
ok('3 quadrados não alcança 2', pickReacher([tok('a', -75, 75)], lev, 2, d).ok, false);
ok('sem limite (0)', pickReacher([tok('a', -3000, 75)], lev, 0, d).ok, true);
ok('escolhe o mais perto', pickReacher([tok('longe', 1500, 75), tok('perto', 225, 75)], lev, 1, d).token.id, 'perto');
ok('sem tokens e com alcance', pickReacher([], lev, 1, d).ok, false);
ok('dentro do objeto = 0', distToShape({ x: 375, y: 75 }, lev), 0);

// portas da névoa (Smoke & Spectre e névoa do Owlbear)
import { setDoor, doorIsOpen, isFogDoor, doorIsLocked } from '../src/shared.js';
const S = 'com.battle-system.smoke/';
const door = () => ({ id: 'p', type: 'CURVE', metadata: { [`${S}isVisionLine`]: true, [`${S}isDoor`]: true, [`${S}blocking`]: true } });
const p1 = door();
const t1 = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
t1('linha com isDoor é porta; parede comum não', [isFogDoor(p1), isFogDoor({ metadata: { [`${S}isVisionLine`]: true } })], [true, false]);
t1('abrir: doorOpen + disabled (como o Smoke faz)', [setDoor(p1, 'abrir'), p1.metadata[`${S}doorOpen`], p1.metadata[`${S}disabled`]], [true, true, true]);
t1('alternar fecha e tira as duas marcas', [setDoor(p1, 'alternar'), `${S}doorOpen` in p1.metadata, `${S}disabled` in p1.metadata, p1.metadata[`${S}blocking`]], [false, false, false, true]);
setDoor(p1, 'trancar');
t1('trancar marca isDoorLocked e não abre', [doorIsLocked(p1), doorIsOpen(p1)], [true, false]);
setDoor(p1, 'destrancar');
t1('destrancar', doorIsLocked(p1), false);
const fog = { id: 'f', type: 'SHAPE', metadata: { 'rodeo.owlbear.dynamic-fog/doors': [{ start: { distance: 0 }, end: { distance: 50 } }, { start: { distance: 90 }, end: { distance: 120 }, open: false }] } };
t1('névoa do Owlbear: abre todas as portas do contorno', [isFogDoor(fog), setDoor(fog, 'abrir'), fog.metadata['rodeo.owlbear.dynamic-fog/doors'].map((d) => d.open)], [true, true, [true, true]]);

const fog2 = { id: 'g', type: 'SHAPE', metadata: { 'rodeo.owlbear.dynamic-fog/doors': [{ open: false }, { open: false }, { open: true }] } };
setDoor(fog2, 'abrir', 1);
t1('névoa do Owlbear: abre só a porta escolhida', fog2.metadata['rodeo.owlbear.dynamic-fog/doors'].map((d) => d.open), [false, true, true]);
t1('alternar uma porta usa o estado dela', [setDoor(fog2, 'alternar', 2), fog2.metadata['rodeo.owlbear.dynamic-fog/doors'].map((d) => d.open)], [false, [false, true, false]]);
t1('sem índice mexe em todas', [setDoor(fog2, 'fechar'), fog2.metadata['rodeo.owlbear.dynamic-fog/doors'].map((d) => d.open)], [false, [false, false, false]]);

// seleção da linha vermelha/ícone da porta do fog do Owlbear (item local) → fog dono + número da porta
import { resolveFogDoors } from '../src/shared.js';
{
  const scene = [{ id: 'fogX', type: 'SHAPE' }, { id: 'outro', type: 'IMAGE' }];
  const local = [{ id: 'L1', type: 'BILLBOARD', attachedTo: 'fogX', position: { x: 10, y: 20 }, metadata: { 'rodeo.owlbear.dynamic-fog/door-index': 2 } }, { id: 'L2', type: 'PATH', attachedTo: 'fogX', position: { x: 0, y: 0 }, metadata: { 'rodeo.owlbear.dynamic-fog/door-index': 2 } }];
  const OBRm = { scene: { items: { getItems: async (ids) => scene.filter((i) => ids.includes(i.id)) }, local: { getItems: async (ids) => local.filter((i) => ids.includes(i.id)) } } };
  const a = await resolveFogDoors(OBRm, ['L1', 'L2']);
  t1('linha/ícone da porta do fog → fog dono, porta 2 e posição do ícone', [a.ids, a.idx, a.pos], [['fogX'], 2, { x: 10, y: 20 }]);
  const b = await resolveFogDoors(OBRm, ['fogX', 'outro']);
  t1('item normal passa direto, sem porta escolhida', [b.ids, b.idx, b.pos], [['fogX', 'outro'], '', null]);
}

// seletor de itens: acha trancados, fog, mapa e escondidos
import { filterItems } from '../src/pickfilter.js';
{
  const its = [
    { id: 'm', type: 'IMAGE', layer: 'MAP', name: 'Mapa do porão', locked: true, visible: true },
    { id: 'f', type: 'PATH', layer: 'FOG', name: 'Fog sala 1', locked: true, visible: true },
    { id: 'p', type: 'IMAGE', layer: 'PROP', name: 'Caixa', locked: false, visible: false },
    { id: 'c', type: 'IMAGE', layer: 'CHARACTER', name: 'Guarda', locked: false, visible: true },
  ];
  const ids = (q, f, d) => filterItems(its, q, f, d).map((i) => i.id);
  t1('seletor: todos, em ordem de camada (fog primeiro)', ids('', 'todos'), ['f', 'm', 'p', 'c']);
  t1('seletor: só trancados / só fog / só mapa / escondidos', [ids('', 'trancado'), ids('', 'FOG'), ids('', 'MAP'), ids('', 'escondido')], [['f', 'm'], ['f'], ['m'], ['p']]);
  t1('seletor: busca por nome ou camada, sem maiúsculas', [ids('PORÃO', 'todos'), ids('fog', 'todos'), ids('personagem', 'todos')], [['m'], ['f'], ['c']]);
  t1('seletor: portas', ids('', 'porta', (i) => i.id === 'f'), ['f']);
}

// restrito: item preso (attachment) ao personagem
import { hasRequired, attachmentsOf, denyText } from '../src/shared.js';
const cena = [{ id: 'rex' }, { id: 'card', name: 'Cartão de Acesso Nível 3', attachedTo: 'rex' }, { id: 'bolsa', name: 'Bolsa', attachedTo: 'lia' }, { id: 'chave', text: { plainText: 'Chave mestra' }, attachedTo: 'bolsa' }, { id: 'lia' }];
t1('preso ao personagem conta (sem acento/maiúscula)', [hasRequired('rex', cena, 'cartao de acesso'), hasRequired('lia', cena, 'cartão de acesso')], [true, false]);
t1('item preso a um item preso também conta', [attachmentsOf('lia', cena).map((i) => i.id), hasRequired('lia', cena, 'chave')], [['bolsa', 'chave'], true]);
t1('sem restrição: qualquer um usa', hasRequired('lia', cena, '  '), true);
t1('mensagem com {item} e {quem}', [denyText({ reqItem: 'Cartão de acesso' }, 'Rex'), denyText({ reqItem: 'Cartão', reqMsg: '{quem} passa o pulso no leitor: nada. Falta o {item}.' }, 'Rex')], ['Acesso negado: é preciso Cartão de acesso.', 'Rex passa o pulso no leitor: nada. Falta o Cartão.']);

// pegar item: onde o item fica preso no token
import { attachPos } from '../src/shared.js';
const tk = { position: { x: 375, y: 375 }, image: { width: 300, height: 300 }, grid: { dpi: 300 }, scale: { x: 1, y: 1 } };
const cd = { position: { x: 900, y: 75 }, image: { width: 100, height: 60 }, grid: { dpi: 200 }, scale: { x: 1, y: 1 } };
t1('pegar: canto de baixo à direita do token', attachPos(cd, tk, 'canto', 150), { x: 375 + 75 - 22.5, y: 375 + 75 - 22.5 });
t1('pegar: centro / onde está', [attachPos(cd, tk, 'centro', 150), attachPos(cd, tk, 'onde', 150)], [{ x: 375, y: 375 }, { x: 900, y: 75 }]);

// 1.13: gasto, nó hackeado, inventário e passar item
import { findRequired, nodeHacked, isInvItem, canGive, heldBy, holderOf, nearby } from '../src/shared.js';
const inv = [{ id: 'rex', layer: 'CHARACTER', type: 'IMAGE', position: { x: 75, y: 75 } }, { id: 'kai', layer: 'CHARACTER', type: 'IMAGE', position: { x: 225, y: 75 } }, { id: 'lia', layer: 'CHARACTER', type: 'IMAGE', position: { x: 825, y: 75 } },
  { id: 'c', type: 'IMAGE', layer: 'ATTACHMENT', name: 'Cartão Nível 2', attachedTo: 'rex', metadata: {} }, { id: 'x', type: 'IMAGE', layer: 'ATTACHMENT', name: 'Selo', attachedTo: 'rex', visible: false, metadata: {} },
  { id: 'lock', type: 'IMAGE', layer: 'ATTACHMENT', name: 'Chip', attachedTo: 'rex', metadata: { 'gatilhos/item': { give: false } } }, { id: 'no', type: 'SHAPE', metadata: { 'vigilancia/no': { state: 'hackeado' } } }, { id: 'no2', type: 'SHAPE', metadata: { 'vigilancia/no': { state: 'ativo' } } }];
t1('acha o item que casa', [findRequired('rex', inv, 'cartao')?.id, findRequired('kai', inv, 'cartao')], ['c', null]);
t1('nó hackeado libera; ativo não; sem nós não', [nodeHacked(inv, ['no']), nodeHacked(inv, ['no2']), nodeHacked(inv, [])], [true, false, false]);
t1('inventário: só itens visíveis presos; fixo não passa', [heldBy('rex', inv).map((i) => i.id), canGive(inv[5]), canGive(inv[3])], [['c', 'lock'], false, true]);
t1('quem carrega o item', [holderOf(inv[3], inv)?.id, holderOf(inv[0], inv)], ['rex', null]);
t1('ao lado passa, longe não', [nearby(inv[0], inv[1], 150), nearby(inv[0], inv[2], 150)], [true, false]);

// alerta com nível, condições e cancelamento (1.14)
import { alertLevel, alertNext, alertMatches, newCond, newTrigger, ALERT } from '../src/shared.js';
import { evalCond, condsOk, cmp } from '../src/conditions.js';
t1('alerta: nível lido da cena (limita 0..3)', [alertLevel({ [ALERT]: { level: 2 } }), alertLevel({ [ALERT]: { level: 9 } }), alertLevel({}), alertLevel({ [ALERT]: { level: -1 } })], [2, 3, 0, 0]);
t1('alerta: subir/descer/ir/zerar', [alertNext(0, 'up'), alertNext(3, 'up'), alertNext(2, 'down'), alertNext(0, 'down'), alertNext(1, 'set', 3), alertNext(2, 'reset')], [1, 3, 1, 0, 3, 0]);
t1('alerta: subir com teto 2 e descer com piso 1', [alertNext(2, 'up', 2), alertNext(1, 'up', 2), alertNext(3, 'down', 1), alertNext(1, 'down', 1)], [2, 2, 2, 1]);
t1('alerta: subir não derruba quem já passou do teto', alertNext(3, 'up', 2), 3);
t1('gatilho de nível: qualquer / só ao subir / só 2 / só ao descer', [
  alertMatches({ alertTo: '', alertDir: 'any' }, 1, 0), alertMatches({ alertTo: '', alertDir: 'up' }, 0, 1),
  alertMatches({ alertTo: '2', alertDir: 'any' }, 2, 1), alertMatches({ alertTo: '2', alertDir: 'any' }, 3, 2),
  alertMatches({ alertTo: '', alertDir: 'down' }, 1, 2), alertMatches({ alertTo: '', alertDir: 'any' }, 1, 1)], [true, false, true, false, true, false]);
t1('comparações', [cmp(2, '>=', 2), cmp(1, '>=', 2), cmp(2, '<=', 2), cmp(3, '==', 3), cmp(3, '!=', 3)], [true, false, true, true, false]);
{
  const S2 = 'com.battle-system.smoke/';
  const items = [
    { id: 'no', metadata: { 'vigilancia/no': { state: 'hackeado' } } },
    { id: 'no2', metadata: { 'vigilancia/no': { state: 'ativo' } } },
    { id: 'porta', type: 'CURVE', metadata: { [`${S2}isDoor`]: true, [`${S2}doorOpen`]: true } },
    { id: 'porta2', type: 'CURVE', metadata: { [`${S2}isDoor`]: true, [`${S2}isDoorLocked`]: true } },
    { id: 'sala', type: 'SHAPE', shapeType: 'RECTANGLE', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, width: 600, height: 600, metadata: {} },
    { id: 'g1', type: 'IMAGE', layer: 'CHARACTER', position: { x: 100, y: 100 }, visible: true, metadata: {} },
    { id: 'g2', type: 'IMAGE', layer: 'CHARACTER', position: { x: 300, y: 300 }, visible: true, metadata: {} },
    { id: 'g3', type: 'IMAGE', layer: 'CHARACTER', position: { x: 400, y: 400 }, visible: false, metadata: {} },
    { id: 'fora', type: 'IMAGE', layer: 'CHARACTER', position: { x: 2000, y: 2000 }, visible: true, metadata: {} },
    { id: 'rex', type: 'IMAGE', layer: 'CHARACTER', position: { x: 2000, y: 0 }, visible: true, metadata: {} },
    { id: 'cartao', type: 'IMAGE', layer: 'ATTACHMENT', attachedTo: 'rex', visible: true, text: { plainText: 'Cartão de Acesso' }, metadata: {} },
  ];
  const env = { alert: 2, items, groups: [{ id: 'g', current: 'noite', states: [{ id: 'dia' }, { id: 'noite' }] }], dpi: 150, zones: ['sala'], actorIds: ['rex'] };
  const C = (o) => ({ ...newCond(o.type), ...o });
  t1('cond alerta (>=2, >=3, <=1)', [evalCond(C({ type: 'alert', op: '>=', n: 2 }), env), evalCond(C({ type: 'alert', op: '>=', n: 3 }), env), evalCond(C({ type: 'alert', op: '<=', n: 1 }), env)], [true, false, false]);
  t1('cond nó hackeado: algum / nenhum / ativo', [evalCond(C({ type: 'node', ids: ['no', 'no2'], is: 'hackeado' }), env), evalCond(C({ type: 'node', ids: ['no2'], is: 'hackeado' }), env), evalCond(C({ type: 'node', ids: ['no2'], is: 'hackeado', op: '!=' }), env)], [true, false, true]);
  t1('cond porta: aberta / trancada / sem itens ignora', [evalCond(C({ type: 'door', ids: ['porta'], is: 'aberta' }), env), evalCond(C({ type: 'door', ids: ['porta'], is: 'trancada' }), env), evalCond(C({ type: 'door', ids: ['porta2'], is: 'trancada' }), env), evalCond(C({ type: 'door', ids: [], is: 'aberta' }), env)], [true, false, true, true]);
  t1('cond estado do grupo: é / não é / sem grupo ignora', [evalCond(C({ type: 'state', group: 'g', is: 'noite' }), env), evalCond(C({ type: 'state', group: 'g', is: 'dia' }), env), evalCond(C({ type: 'state', group: 'g', is: 'dia', op: '!=' }), env), evalCond(C({ type: 'state', group: '', is: '' }), env)], [true, false, true, true]);
  t1('cond contagem na sala: 2 visíveis (3 com escondidos)', [evalCond(C({ type: 'count', op: '==', n: 2 }), env), evalCond(C({ type: 'count', op: '==', n: 3, hid: true }), env), evalCond(C({ type: 'count', op: '>=', n: 3 }), env), evalCond(C({ type: 'count', zones: ['sala'], op: '<=', n: 2 }), env)], [true, true, false, true]);
  t1('cond contagem sem zona ignora', evalCond(C({ type: 'count', op: '>=', n: 9 }), { ...env, zones: [] }), true);
  t1('cond quem ativou tem o item', [evalCond(C({ type: 'has', name: 'cartao' }), env), evalCond(C({ type: 'has', name: 'chave' }), env), evalCond(C({ type: 'has', name: 'chave', op: '!=' }), env), evalCond(C({ type: 'has', name: 'cartao' }), { ...env, actorIds: ['g1'] })], [true, false, true, false]);
  const tr = { conds: [C({ type: 'alert', op: '>=', n: 2 }), C({ type: 'alert', op: '>=', n: 3 })], condAny: false };
  t1('várias: todas / qualquer uma / nenhuma condição', [condsOk(tr, env), condsOk({ ...tr, condAny: true }, env), condsOk({ conds: [] }, env), condsOk(newTrigger(), env)], [false, true, true, true]);
}

// botão direito: de que gatilhos um item faz parte (1.15)
import { involvedIds } from '../src/shared.js';
t1('itens de um gatilho: zonas, alvos, destino, atirador, nós e condições (sem "quem ativou" e sem repetir)', involvedIds({ zones: ['z1'], who: 'chars', tokens: ['x'], reqNodes: ['n1'], effects: [{ targets: ['@quem', 'a', 'z1'], dest: 'd', shooter: 's' }, { targets: [] }], conds: [{ ids: ['porta'], zones: ['sala'] }] }), ['z1', 'n1', 'a', 'd', 's', 'porta', 'sala']);
t1('tokens da lista só contam se o gatilho é "só estes tokens"', [involvedIds({ zones: [], who: 'list', tokens: ['x'], effects: [] }), involvedIds({ zones: [], who: 'chars', tokens: ['x'], effects: [] })], [['x'], []]);

// porta animada (1.17)
import { animDoorPlan } from '../src/shared.js';
{
  const e = { doorOp: 'alternar', vfxOpen: 'https://x.io/abre.webm', vfxClose: 'https://x.io/fecha.webm', vfxWait: 1.5, imgOpen: 'Aberta', imgClosed: '' };
  t1('porta animada: fechada → abre com o vídeo de abrir e a imagem "Aberta"', animDoorPlan(e, false), { opening: true, noop: false, url: 'https://x.io/abre.webm', to: 'Aberta', wait: 1.5 });
  t1('aberta → fecha com o vídeo de fechar e a imagem anterior', animDoorPlan(e, true), { opening: false, noop: false, url: 'https://x.io/fecha.webm', to: 'prev', wait: 1.5 });
  t1('"abrir" com a porta já aberta não faz nada; "fechar" com ela fechada também', [animDoorPlan({ ...e, doorOp: 'abrir' }, true).noop, animDoorPlan({ ...e, doorOp: 'fechar' }, false).noop, animDoorPlan({ ...e, doorOp: 'abrir' }, false).noop], [true, true, false]);
  t1('sem vídeo de fechar ou com link inválido: sem vídeo, troca na hora', [animDoorPlan({ ...e, vfxClose: '' }, true).url, animDoorPlan({ ...e, vfxOpen: 'javascript:x', vfxWait: 0 }, false).url, animDoorPlan({ vfxOpen: '' }, false).wait], ['', '', 0]);
  t1('porta animada: a imagem entra na lista de itens do gatilho', involvedIds({ zones: ['img'], effects: [{ targets: ['linha'], doorImgs: ['img', 'img2'] }] }), ['img', 'linha', 'img2']);
}

// ---- porta animada com fog de várias portas: o estado vem da porta escolhida ----
{
  const fog = { metadata: { 'rodeo.owlbear.dynamic-fog/doors': [{ open: true, start: {}, end: {} }, { open: false, start: {}, end: {} }] } };
  t1('doorIsOpen com índice olha só aquela porta', [doorIsOpen(fog, '0'), doorIsOpen(fog, '1'), doorIsOpen(fog, ''), doorIsOpen(fog)], [true, false, true, true]);
}
