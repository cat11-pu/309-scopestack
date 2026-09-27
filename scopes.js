// scopes.js：作用域栈的操作（每层是声明名列表，层号从零数）
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export function enterScope(scopes) {
  return scopes.concat([[]]);
}

export function leaveScope(scopes) {
  if (scopes.length <= 1) {
    fail("E_UNBALANCED", "leaveScope with only the outermost scope left");
  }
  return scopes.slice(0, scopes.length - 1);
}

export function declareName(scopes, name) {
  const inner = scopes[scopes.length - 1];
  if (inner.indexOf(name) !== -1) {
    fail("E_REDECLARED", "name declared twice in the same scope: " + name);
  }
  return scopes.slice(0, scopes.length - 1).concat([inner.concat([name])]);
}

export function lookupName(scopes, name) {
  for (let depth = scopes.length - 1; depth >= 0; depth -= 1) {
    if (scopes[depth].indexOf(name) !== -1) {
      return depth;
    }
  }
  return -1;
}
