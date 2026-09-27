import assert from "node:assert";
import { enterScope, leaveScope, declareName, lookupName } from "../scopes.js";
import { step, close } from "../scoperun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { scopes: [[]], found: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "declare", name: "x" }],
  undeclared_error_code: "E_UNDECLARED", redeclared_error_code: "E_REDECLARED",
  scope_error_code: "E_UNBALANCED", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("enterScope returns scopes", () => {
  assert.ok(Array.isArray(enterScope([[]])));
});

check("declareName returns scopes", () => {
  assert.ok(Array.isArray(declareName([[]], "z")));
});

check("lookupName returns a number", () => {
  assert.strictEqual(typeof lookupName([["z"]], "z"), "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
