import assert from "node:assert/strict";
import {controlsFor,keyFor} from "../shared/visibility.mjs";

globalThis.location = new URL("https://example.test/clima/background.html");
const settle = () => new Promise(done => setTimeout(done, 0));
const tools = new Map(), menus = new Map(), panels = new Map();
const api = map => ({create:async spec => map.set(spec.id,spec), remove:async id => map.delete(id)});
let role = "PLAYER", settings = {}, roomChanged, roleChanged;
const obr = {
  onReady:fn => fn(),
  player:{getRole:async () => role,onChange:fn => { roleChanged = fn; }},
  room:{getMetadata:async () => settings,onMetadataChange:fn => { roomChanged = fn; }},
  tool:api(tools), contextMenu:api(menus),
  popover:{open:async spec => panels.set(spec.id,spec),close:async id => panels.delete(id)}
};
const controls = controlsFor(obr,"clima");
await controls.contextMenu.create({id:"area",icons:[]});
await settle();
assert.equal(tools.size,1);
await controls.openPanel();
assert.equal(panels.size,1);
roomChanged(settings = {[keyFor("clima")]:true});
await settle();
assert.deepEqual([tools.size,menus.size,panels.size],[0,0,0]);
await controls.contextMenu.create({id:"novo",icons:[]});
await controls.contextMenu.remove("area");
assert.equal(menus.size,0);
roleChanged({role:"GM"});
await settle();
assert.equal(tools.size,1);
assert.deepEqual([...menus.keys()],["novo"]);
roleChanged({role:"PLAYER"});
await settle();
assert.equal(tools.size,0);
roomChanged(settings = {});
await settle();
assert.equal(tools.size,1);
assert.equal(menus.size,1);
console.log("Visibilidade, funções, menus dinâmicos e fechamento de painel: OK");
