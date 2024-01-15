// Polyfills for ES5 runtime (MuJS)
// FIXME: use simple polyfill library? core-js seems too bloated

// https://stackoverflow.com/a/1144788
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll
export function StringReplaceAll(str: string, find: string, replace: string) {
  return str.replace(new RegExp(escapeRegExp(find), "g"), replace);
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll
export function StringMatchAll(str: string, re: RegExp) {
  const res: string[][] = [];
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(str)) !== null) {
    res.push(match);
  }
  return res;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
export function StringStartsWith(str: string, prefix: string) {
  return str.indexOf(prefix) === 0;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes
export function StringIncludes(str: string, search: string) {
  return str.indexOf(search) !== -1;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
export function StringEndsWith(str: string, suffix: string) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
export function ObjectEntries<T>(obj: { [key: string]: T }) {
  const res: [string, T][] = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      res.push([key, obj[key]]);
    }
  }
  return res;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries
export function ObjectFromEntries<T>(entries: [string, T][]) {
  const res: { [key: string]: T } = {};
  for (const [key, value] of entries) {
    res[key] = value;
  }
  return res;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
export function ObjectAssign<T>(target: T, ...sources: Partial<T>[]) {
  for (const source of sources) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        target[key] = source[key] as any;
      }
    }
  }
  return target;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/entries
export function ArrayEntries<T>(arr: T[]) {
  const res: [number, T][] = [];
  for (let i = 0; i < arr.length; i++) {
    res.push([i, arr[i]]);
  }
  return res;
}
