
const window = (1 && (function () { return this }()))

if (!window || window.window !== window) {
  throw new Error('Error occurred, can only run in browser environment.')
}

// use to parse url.
const a = window.document.createElement('a')


/**
 * parse url.
 * 
 * @param {string} url
 * @return {object}
 *  
 */
export function parseUrl(url) {
  a.href = url
  return {
    url: url,                           // origin url.
    host: a.host,                       // url hostname and port. 
    port: a.port,
    hash: a.hash.slice(1),              // url hash string (without '#').
    hostname: a.hostname,
    pathname: a.pathname,               // resource path.
    protocol: a.protocol.slice(-1),     // url protocol (http/https/file...).
    search: params(a.search.slice(1)),  // search params { key: value }.
  }
}


/**
 * conver 'name=ly&age=18' to { name: 'ly', age: '18' }
 * 
 * @param {string} searchStr
 * @return {object} 
 * 
 */
function params(searchStr) {
  return searchStr.split('&')
    .map((param) => {
      const division = param.indexOf('=')
      const key = param.slice(division)
      const value = param.slice(division + 1)
      return { [key]: value }
    })
    .reduce((pre, next) => Object.assign({}, pre, next), {})
}


export function isEmpty(value) {
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'symbol') {
    return !value
  }
  const keys = Object.keys(value)
  return keys.length === 0
}
