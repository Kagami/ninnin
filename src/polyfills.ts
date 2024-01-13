// Polyfills for ES5 runtime (MuJS)
// FIXME: use simple polyfill library? core-js seems too bloated

// https://stackoverflow.com/a/1144788
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll
export function replaceAll(str: string, find: string, replace: string) {
  return str.replace(new RegExp(escapeRegExp(find), "g"), replace);
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll
export function matchAll(str: string, re: RegExp) {
  const res: string[][] = [];
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(str)) !== null) {
    res.push(match);
  }
  return res;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
export function endsWith(str: string, suffix: string) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
export function ObjectEntries(obj: any) {
  const res: [string, any][] = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      res.push([key, obj[key]]);
    }
  }
  return res;
}
