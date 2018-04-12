const util = require('./util')
const xhrlib = require('./stream-source/xmlhttprequest')

const STATE = xhrlib.STATE
const without = util.without
const responseCache = {}

function thunk(readstream, writestream) {
  readstream.subscribe(handleHttpReadStream)
  // readstream.subscribe(function (data) {
  //   console.log('thunk', this)
  //   console.log('thunk', data)
  // })
  writestream.subscribe(handleHttpWriteStream)
}

function handleHttpReadStream(bundle) {
  const request = bundle.data || {}
  const error = bundle.error
  const meta = request.meta
  const sendData = request.data
  const url = request.url
  const method = request.method
  const headers = request.headers

  if (error) {
    // handle error
    return
  }

  if (meta.type === 'XHR') {
    const context = meta.ctx
    if (!context || context.aborted || context.sended) { return }
    context.triggerEvent('statechange')
    context.originOpen(method, url)
    context.changestate(STATE['OPENED'])
    context.triggerEvent('statechange')
    handleHeaders(headers, context)
    context.mergeRequest({ data: sendData })
    context.mergeResponse({ request: Object.assign({}, context.request) })
	context.onerror = context.handleException
    context.abort = context.handleException
    context.timeout = context.handleException
    context.originSend(sendData)
    context.sended = true
  }
}

function handleHeaders(headers, ctx) {
  const keys = Object.keys(headers)
  keys.forEach((key) => ctx.originSetRequestHeader(key, headers[key]))
}

function handleHttpWriteStream(bundle) {
  const response = bundle.data || {}
  const error = bundle.error
  const meta = response.meta

  if (error) {
    // handle error
    return
  }

  if (meta.type === 'XHR') {
    const withoutProps = ['readystate', 'meta']
    const context = meta.ctx
    if (!context || context.aborted) { return }
    const id = context.id
    const readystate = response.readystate
    const cache = responseCache[id] || (responseCache[id] = {})

    if (readystate === STATE['HEADERS_RECEIVED']) {
      const receive = cache[STATE['HEADERS_RECEIVED']] || (cache[STATE['HEADERS_RECEIVED']] = {})
      const res = without(response, withoutProps)
      handleHeaderRecerved(receive, context, res)
    }

    if (readystate === STATE['LOADING']) {
      const receive = cache[STATE['HEADERS_RECEIVED']]
      const loading = cache[STATE['LOADING']] || (cache[STATE['LOADING']] = {})
      const res = without(response, withoutProps)
      const data = loading.data || (loading.data = [])
      res.data = context.getResponseData()
      if (receive && receive.done) {
        handleLoading(loading, context, data.concat(res))
      } else {
        data.push(res)
        loading.done = false
        loading.data = data
      }
    }

    if (readystate === STATE['DONE']) {
      const loading = cache[STATE['LOADING']]
      const done = cache[STATE['DONE']] || (cache[STATE['DONE']] = {})
      const res = without(response, withoutProps)
      res.data = context.getResponseData()
      if (loading && loading.done) {
        handleDone(done, context, res)
      } else {
        done.done = false
        done.data = res
      }
    }
  }
}

function handleHeaderRecerved(cache, ctx, response) {
  ctx.changestate(STATE['HEADERS_RECEIVED'])
  ctx.mergeResponse(response)
  ctx.triggerEvent('statechange')
  cache.done = true
  checkCache(STATE['HEADERS_RECEIVED'], cache, response, ctx)
}

function handleLoading(cache, ctx, response) {
  const res = response || cache.data
  if (!res) { return }
  ctx.changestate(STATE['LOADING'])
  res.forEach((newRes) => {
    ctx.mergeResponse(newRes)
    ctx.triggerEvent('statechange')
    checkCache(STATE['LOADING'], cache, newRes, ctx)
  })
  cache.done = true
  cache.data = []
}

function handleDone(cache, ctx, response) {
  const res = response || cache.data
  if (!res) { return }
  ctx.changestate(STATE['DONE'])
  ctx.mergeResponse(res)
  ctx.triggerEvent('statechange')
}


function checkCache(readystate, cache, res, ctx) {
  const receive = cache[STATE['HEADERS_RECEIVED']]
  const loading = cache[STATE['LOADING']]
  const done = cache[STATE['DONE']]
  if (readystate === STATE['HEADERS_RECEIVED']) {
    if (loading && !loading.done) {
      handleLoading(loading, ctx)
    }
    if (done && !done.done) {
      handleDone(done, ctx)
    }
  }

  if (readystate === STATE['LOADING']) {
    if (!receive || !receive.done) {
      return
    }
    if (
      done
      && !done.done
      && String(res).lenght >= String(done.data).lenght
    ) {
      handleDone(done, ctx)
    }
  }
}

module.exports = {
  thunk,
}