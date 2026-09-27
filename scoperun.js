// scoperun.js：按处理预算处理事件，预算用尽压账，收尾不限预算清账
import { enterScope, leaveScope, declareName, lookupName } from "./scopes.js";

const DEFAULT_CODES = {
  undeclared: "E_UNDECLARED",
  redeclared: "E_REDECLARED",
  unbalanced: "E_UNBALANCED",
  badEvent: "E_BAD_EVENT"
};

function codes(spec) {
  spec = spec || {};
  return {
    undeclared: spec.undeclared_error_code || DEFAULT_CODES.undeclared,
    redeclared: spec.redeclared_error_code || DEFAULT_CODES.redeclared,
    unbalanced: spec.scope_error_code || DEFAULT_CODES.unbalanced,
    badEvent: spec.event_error_code || DEFAULT_CODES.badEvent
  };
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function validEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return false;
  }
  if (event.kind === "enter" || event.kind === "leave") {
    return true;
  }
  return (event.kind === "declare" || event.kind === "use") && typeof event.name === "string";
}

function ledgerEntry(event) {
  return (event.kind === "declare" || event.kind === "use")
    ? [event.kind, event.name]
    : [event.kind];
}

function copyState(state) {
  const src = state || {};
  const scopes = Array.isArray(src.scopes) && src.scopes.length ? src.scopes : [[]];
  return {
    scopes: scopes.map(function (names) { return names.slice(); }),
    found: (src.found || []).map(function (pair) { return pair.slice(); }),
    ledger: (src.ledger || []).slice(),
    applied: (src.applied || []).slice()
  };
}

function applyEvent(state, event, codeSet) {
  if (event.kind === "enter") {
    state.scopes = enterScope(state.scopes);
  } else if (event.kind === "leave") {
    try {
      state.scopes = leaveScope(state.scopes);
    } catch (error) {
      if (error && error.code === DEFAULT_CODES.unbalanced) {
        fail(codeSet.unbalanced, error.message);
      }
      throw error;
    }
  } else if (event.kind === "declare") {
    try {
      state.scopes = declareName(state.scopes, event.name);
    } catch (error) {
      if (error && error.code === DEFAULT_CODES.redeclared) {
        fail(codeSet.redeclared, error.message);
      }
      throw error;
    }
  } else if (event.kind === "use") {
    const depth = lookupName(state.scopes, event.name);
    if (depth < 0) {
      fail(codeSet.undeclared, "name used before any declaration: " + event.name);
    }
    state.found = state.found.concat([[event.name, depth]]);
  }
}

function alreadyApplied(state, event) {
  return event.id !== undefined && event.id !== null && state.applied.indexOf(event.id) !== -1;
}

function markApplied(state, event) {
  if (event.id !== undefined && event.id !== null) {
    state.applied.push(event.id);
  }
}

export function step(spec) {
  const events = Array.isArray(spec.events) ? spec.events : [];
  const codeSet = codes(spec);
  for (const event of events) {
    if (!validEvent(event)) {
      fail(codeSet.badEvent, "bad event: " + JSON.stringify(event));
    }
  }
  const state = copyState(spec.state);
  const budget = Math.max(0, spec.budget == null ? events.length : spec.budget);
  const bound = state.ledger.length + events.length;
  const queue = state.ledger.concat(events);
  const remaining = [];
  let spent = 0;
  let served = 0;
  for (const event of queue) {
    if (alreadyApplied(state, event)) {
      continue;
    }
    if (spent >= budget) {
      remaining.push(event);
      continue;
    }
    applyEvent(state, event, codeSet);
    markApplied(state, event);
    spent += 1;
    served += 1;
  }
  state.ledger = remaining;
  return {
    state: state,
    served: served,
    ledger_before: remaining.length,
    ledger: remaining.map(ledgerEntry),
    judged: served,
    judged_bound: bound
  };
}

export function close(spec) {
  const codeSet = codes(spec);
  const state = copyState(spec.state);
  const queue = state.ledger;
  state.ledger = [];
  let catchup = 0;
  for (const event of queue) {
    if (alreadyApplied(state, event)) {
      continue;
    }
    applyEvent(state, event, codeSet);
    markApplied(state, event);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
