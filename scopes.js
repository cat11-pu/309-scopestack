// scopes.js：词法作用域栈（进块压层、出块弹层、当前层声明、由内向外查找）
// 约定：就地更新传入的栈并返回它；栈深为 0 时按最外层补齐，深为 1 时禁止再弹。
export function enterScope(scopes) {
  scopes.push([]);
  return scopes;
}

export function leaveScope(scopes) {
  if (scopes.length <= 1) {
    const error = new Error("只剩最外层作用域，不能再弹出");
    error.code = "E_UNBALANCED";
    throw error;
  }
  scopes.pop();
  return scopes;
}

export function declareName(scopes, name) {
  const top = scopes[scopes.length - 1];
  if (top.indexOf(name) !== -1) {
    const error = new Error("同层已声明过名字：" + name);
    error.code = "E_REDECLARED";
    throw error;
  }
  top.push(name);
  return scopes;
}

export function lookupName(scopes, name) {
  for (let depth = scopes.length - 1; depth >= 0; depth -= 1) {
    if (scopes[depth].indexOf(name) !== -1) {
      return depth;
    }
  }
  return -1;
}
