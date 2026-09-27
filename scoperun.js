// scoperun.js：按处理预算逐条处理事件，用尽预算的事件连着载压在账上，
// 由下一轮（或收尾）继续处理；已处理集合保证重放不再处理。
import { enterScope, leaveScope, declareName, lookupName } from "./scopes.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

// 事件结构校验：与预算无关，先于一切处理。
function validateEvent(event) {
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    fail("E_BAD_EVENT", "事件必须是对象");
  }
  if (event.kind === "enter" || event.kind === "leave") {
    return;
  }
  if (event.kind === "declare" || event.kind === "use") {
    if (typeof event.name !== "string" || event.name.length === 0) {
      fail("E_BAD_EVENT", event.kind + " 事件必须带非空 name");
    }
    return;
  }
  fail("E_BAD_EVENT", "不认识的事件类型：" + String(event.kind));
}

// 压账的紧凑表示：["declare","x"]、["use","x"]、["enter"]、["leave"]。
// id 挂在数组的非下标属性上，JSON 序列化时不可见，却能带去下一轮做去重。
function toLedgerItem(work) {
  const item = work.name === undefined ? [work.kind] : [work.kind, work.name];
  if (work.id !== undefined && work.id !== null) {
    item.id = work.id;
  }
  return item;
}

function fromLedgerItem(item) {
  return { kind: item[0], name: item[1], id: item.id };
}

function applyWork(work, state) {
  if (work.kind === "enter") {
    enterScope(state.scopes);
  } else if (work.kind === "leave") {
    leaveScope(state.scopes);
  } else if (work.kind === "declare") {
    declareName(state.scopes, work.name);
  } else if (work.kind === "use") {
    const depth = lookupName(state.scopes, work.name);
    if (depth < 0) {
      fail("E_UNDECLARED", "名字没有声明过：" + work.name);
    }
    state.found.push([work.name, depth]);
  } else {
    fail("E_BAD_EVENT", "不认识的事件类型：" + String(work.kind));
  }
}

function cloneState(state) {
  return {
    scopes: (state.scopes.length ? state.scopes : [[]]).map(function (names) {
      return names.slice();
    }),
    found: state.found.map(function (pair) { return [pair[0], pair[1]]; }),
    ledger: state.ledger.slice(),
    applied: state.applied.slice()
  };
}

// 核心一轮：先把账上的事接着做，再做这轮新到的事件，预算用尽就把剩下的连着压账。
function run(state, events, budget) {
  events.forEach(validateEvent);

  const next = cloneState(state);
  const priorApplied = next.applied.length;
  const applied = new Set(next.applied);

  // 合并队列：旧账在前、新事件在后；同 id 只排一次（重放直接跳过，不花预算）。
  const queue = [];
  const queued = new Set();
  function enqueue(work) {
    const key = String(work.id);
    if (work.id !== undefined && work.id !== null) {
      if (queued.has(key)) { return; }
      queued.add(key);
    }
    queue.push(work);
  }
  next.ledger.forEach(function (item) { enqueue(fromLedgerItem(item)); });
  let synthetic = 0;
  events.forEach(function (event) {
    const id = event.id === undefined || event.id === null ? --synthetic : event.id;
    enqueue({ kind: event.kind, name: event.name, id: id });
  });

  let served = 0;
  let remaining = budget;
  const ledger = [];
  for (let i = 0; i < queue.length; i += 1) {
    const work = queue[i];
    if (work.id !== undefined && work.id !== null && applied.has(work.id)) {
      continue;
    }
    if (remaining <= 0) {
      ledger.push(toLedgerItem(work));
      continue;
    }
    applyWork(work, next);
    if (work.id !== undefined && work.id !== null) {
      applied.add(work.id);
      next.applied = Array.from(applied);
    }
    served += 1;
    remaining -= 1;
  }
  next.ledger = ledger;

  return {
    state: next,
    served: served,
    ledger_before: ledger.length,
    ledger: ledger,
    judged: next.applied.length,
    judged_bound: priorApplied + events.length
  };
}

export function step(spec) {
  const budget = Number.isFinite(spec.budget) ? Math.max(0, Math.trunc(spec.budget)) : 0;
  return run(spec.state, spec.events || [], budget);
}

// 收尾：不限预算，只把账上没处理完的事件处理完。
export function close(spec) {
  const result = run(spec.state, [], Number.POSITIVE_INFINITY);
  return { state: result.state, catchup: result.served };
}
