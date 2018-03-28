const util = require('./util')
const xhrlib = require('./stream-source/xmlhttprequest')

const STATE = xhrlib.STATE
const without = util.without
const responseCache = {}

function thunk(readstream, writestream) {
  readystream.subscribe()
}

function handleHttpReadStream(bundle) {
  const request = bundle.data
  const error = bundle.error
  const meta = bundle.meta

  if (error) {
    // handle error
    return
  }

  if (meta.type === 'XHR') {
    if (!context || context.aborted) { return }
    const context = meta.ctx
    context.originSend(request.data)
  }
}

function handleHttpWriteStream(data) {
  const response = bundle.data
  const error = bundle.error
  const meta = bundle.meta

  if (error) {
    // handle error
    return
  }

  if (meta.type === 'XHR') {
    if (!context || context.aborted) { return }
    const context = meta.ctx
    const id = context.id
    const readystate = response.readystate
    const cache = responseCache[id] || (responseCache[id] = {})

    if (readystate === STATE['HEADERS_RECEIVED']) {
      context.mergeRespose(without(response, 'readystate'))
      context.triggerEvent('statechange')
      cache[STATE['HEADERS_RECEIVED']] = { done: true }
    }

    if (readystate === STATE['LOADING']) {
      const receive = cache[STATE['HEADERS_RECEIVED']]
      const res = without(response, 'readystate')
      if (receive && receive.done) {
        context.mergeRespose(res)
        context.triggerEvent('statechange')
      } else {
        cache[STATE['HEADERS_RECEIVED']] = { done: false, data: res }
      }
    }

    if (readystate === STATE['DONE']) {
      const loading = cache[STATE['LOADING']]
      
    }
  }
}


function checkCache(readystate, cache, res, context) {
  const receive = cache[STATE['HEADERS_RECEIVED']]

  if (readystate === STATE['HEADERS_RECEIVED']) {
    const loading = cache[STATE['LOADING']]
    const done = cache[STATE['DONE']]

    if (loading && !loading.done) {
      context.response = Object.assign(context.response, res)
      context.event['statechange'].forEach((fn) => fn.call(context))

    }
  }
}
