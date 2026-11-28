export const extensions = {
  "arsenal": ["Arsenal",400,680],
  "balde-de-fog": ["Balde de Fog",320,640],
  "clima": ["Clima",320,420],
  "estados": ["Estados",380,640],
  "gatilhos": ["Gatilhos",380,640],
  "handouts": ["Handouts",400,640],
  "inventario": ["Inventário de mesa",390,510],
  "luz-colorida": ["Luz Colorida",320,560],
  "otimizador": ["Otimizador",360,620],
  "regua": ["Régua"],
  "tetos": ["Tetos",320,380],
  "trocador": ["Trocador"],
  "anonimato": ["Anonimato",380,560],
  "vigilancia": ["Vigilância",380,620],
  "selecao": ["Seleção total"]
};
export const keyFor = id => "fog-fill.visibilidade/" + id;

// Subscribe before reading so a late snapshot cannot replace a newer room event.
export function observe(obr, update) {
  let role, metadata, roleEvent = false, roomEvent = false;
  function emit() { if (role && metadata) update(role, metadata); }
  obr.player.onChange(p => { roleEvent = true; role = p.role; emit(); });
  obr.room.onMetadataChange(m => { roomEvent = true; metadata = m; emit(); });
  return Promise.all([obr.player.getRole(), obr.room.getMetadata()]).then(([r,m]) => {
    if (!roleEvent) role = r;
    if (!roomEvent) metadata = m;
    emit();
  });
}

const instances = new WeakMap();
export function controlsFor(obr, id) {
  if (instances.has(obr)) return instances.get(obr);
  const background = location.pathname.endsWith("/background.html");
  function panelAccess(allowed) {
    if (!background) {
      document.documentElement.hidden = !allowed;
      document.documentElement.inert = !allowed;
    }
  }
  panelAccess(false);
  const registrations = new Map(), windows = new Map();
  let visible = false, queue = Promise.resolve();
  function enqueue(fn) {
    const pending = queue.then(fn);
    queue = pending.catch(e => console.error("Visibilidade:", e));
    return pending;
  }
  function registry(api, create, remove, prefix = create) {
    return {
      add(spec) {
        const key = prefix + "/" + spec.id;
        return enqueue(async () => {
          const guarded = {...spec};
          for (const [k, fn] of Object.entries(spec)) {
            if (typeof fn === "function" && k !== "onDeactivate" && k !== "onToolDragCancel") {
              guarded[k] = (...args) => visible ? fn(...args) : false;
            }
          }
          let registered = false;
          const entry = {
            async show() { if (!registered) { await api[create](guarded); registered = true; } },
            async hide() { if (registered) { await api[remove](spec.id); registered = false; } }
          };
          registrations.set(key, entry);
          if (visible) await entry.show();
        });
      },
      drop(itemId) {
        return enqueue(async () => {
          const key = prefix + "/" + itemId;
          await registrations.get(key)?.hide();
          registrations.delete(key);
        });
      }
    };
  }
  function windowApi(api) {
    return {
      open(spec) { return enqueue(async () => {
        if (!visible) return;
        await api.open(spec);
        windows.set(spec.id, () => api.close(spec.id));
      }); },
      close(winId) { windows.delete(winId); return api.close(winId); }
    };
  }
  const tool = registry(obr.tool,"create","remove");
  const mode = registry(obr.tool,"createMode","removeMode");
  const action = registry(obr.tool,"createAction","removeAction");
  const context = registry(obr.contextMenu,"create","remove","context");
  const popover = windowApi(obr.popover);
  const openPanel = async () => { if (visible) await obr.action.open(); };
  const controls = {tool:{create:tool.add,createMode:mode.add,createAction:action.add},
    contextMenu:{create:context.add,remove:context.drop},popover,modal:windowApi(obr.modal),openPanel};
  instances.set(obr,controls);
  obr.onReady(() => {
    observe(obr,(role,m) => {
      const next = role === "GM" || m[keyFor(id)] !== true;
      panelAccess(next);
      if (!next && location.pathname.endsWith("/index.html") && extensions[id].length > 1) {
        obr.action.close().catch(console.error);
      }
      if (visible === next) return;
      visible = next;
      enqueue(async () => {
        if (visible !== next) return;
        const entries = Array.from(registrations.values());
        if (!next) entries.reverse();
        for (const entry of entries) {
          try { await (next ? entry.show() : entry.hide()); } catch(e) { console.error(id,e); }
        }
        if (!next) {
          await Promise.allSettled(Array.from(windows.values(),close => close()));
          windows.clear();
        }
      });
    }).catch(console.error);

  });
  return controls;
}
