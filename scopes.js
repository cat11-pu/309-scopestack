// scopes.js：作用域栈的操作（基线：一律原样返回）
export function enterScope(scopes) {
  return scopes;
}

export function leaveScope(scopes) {
  return scopes;
}

export function declareName(scopes, name) {
  return scopes;
}

export function lookupName(scopes, name) {
  return -1;
}
