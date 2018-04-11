
const window = (1 && (function () { return this }()))

if (!window || window.window !== window) {
  // annotation this for test.
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
function parseUrl(url) {
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


function isEmpty(value) {
  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'symbol') {
    return !value
  }
  const keys = Object.keys(value)
  return keys.length === 0
}


function uniqueId() {
  const seed = new Date().getTime()
  const id = (Math.random() * seed + seed).toFixed(0)
  return id
}

function without(object, props) {
  const nextObj = Object.assign({}, object)
  Array.isArray(props)
    ? props.forEach((property) => delete nextObj[property])
    : delete nextObj[props]
  return nextObj
}


function returnNull() {
  return () => null
}

function noop () {}

function has(object, property) {
  return !!(property in object)
}

function s2j(str) {
  try {
    return JSON.parse(str)
  } catch(e) {
    return null
  }
}

function s2doc(str, mime = 'text/html') {
  const parser = new DOMParser()
  parser.parseFromString(str, mime);
}

function s2ab(str) {
  if (window.TextEncoder) {
    return new TextEncoder('utf-8').encode(str)
  } else {
    const buf = new ArrayBuffer(str.length)
    const bufView = new Uint8Array(buf)
    for (let i=0; i < str.length; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf
  }
}

function ab2s(ab) {
  if (typeof ab === 'string') { return ab }
  try {
    if (window.TextDecoder) {
      return new TextDecoder('utf-8').decode(ab)
    } else {
      return String.fromCharCode.apply(null, new Uint8Array(ab));
    }
  } catch(e) {
    return ab
  }
}

function s2b(str) {
  return new Blob([mystring], {
    type: 'text/plain'
  })
}

const transform = {
  s2j,
  s2b,
  s2ab,
  s2doc,
  ab2s,
}

module.exports = {
  parseUrl,
  isEmpty,
  uniqueId,
  without,
  returnNull,
  noop,
  has,
  transform,
}
