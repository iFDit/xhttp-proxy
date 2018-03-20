import Rx from 'rxjs'
import _ from 'lodash'

const onRequest = new Rx.Subject()
const onResponse = new Rx.Subject()
let onRequestCallback = []
let onResponseCallback = []

function getInterceptData(observable, originData) {
  let data = originData
  let done = false

  const assign = (nextData) => {
    if (!done) {
      data = nextData || originData
      done = true
    }
    return data
  }

  observable.subscribe(assign)
  return new Promise((resolve, reject) =>
    setTimeout(() => resolve(data), 20)
  ).then(assign)
}

function getReq(observable, originRequest) {
  return getInterceptData(observable, originRequest)
}

function getRes(observable, originResponse) {
  return getInterceptData(observable, originResponse)
}

function withoutProperty(object, props) {
  const nextObj = Object.assign({}, object)
  Array.isArray(props)
    ? props.forEach((property) => delete nextObj[property])
    : delete nextObj[props]
  return nextObj
}


if (window.fetch) {
  const originFetch = window.fetch

  const handleFetchReq = (request) => {
    const url = request.url
    const secondParams = withoutProperty(request, 'url')
    return originFetch(url, secondParams)
  }

  const handleFetchRes = (response) => {
    const innerObservable = new Rx.Subject()
    onResponse.next({ response, innerObservable })
    return getRes(innerObservable, response)
  }

  window.fetch = function (...args) {
    const innerObservable = new Rx.Subject()
    const url = _.get(args, '0', null)
    const request = Object.assign({}, args[1] || {}, { url })
    const fetchResult = getReq(innerObservable, request)
      .then(handleFetchReq)
      .then(handleFetchRes)

    onRequest.next(Object.assign({}, { request }, { innerObservable }))

    return fetchResult
  }
}

if (window.XMLHttpRequest) {
  const BaseXMLHttpRequest = window.XMLHttpRequest
  let request = {}
  window.XMLHttpRequest = class extends BaseXMLHttpRequest {
    constructor() {
      super()
      this.beSend = false
      this.onload = function () {
        const innerObservable = new Rx.Subject()
        onResponse.next({ response: this, innerObservable })
      }
    }

    open(...args) {
      const method = args[0] || 'GET'
      const url = args[1] || ''
      request = Object.assign({}, request, { url, method })
      if (this.beSend) { super.open(...args) }
    }

    setRequestHeader(...args) {
      request = Object.assign({}, request, { [args[0]]: args[1] })
      if (this.beSend) { super.setRequestHeader(...args) }
    }

    send(...args) {
      this.beSend = true
      const innerObservable = new Rx.Subject()
      const handleSendReq = (request) => {
        this.open(request.method, request.url)
        const restReq = withoutProperty(request, ['method', 'url'])
        for (const header in restReq) {
          this.setRequestHeader(header, restReq[header])
        }
        super.send(...args)
      }

      getReq(innerObservable, request).then(handleSendReq)
      onRequest.next(Object.assign({}, request, { innerObservable }))
    }
  }
}

function on(type, callback) {
  const list = type === 'request'
    ? onRequestCallback
    : type === 'response' ? onResponseCallback : []

  list.push(callback)
}

function off(type, callback) {
  const isRequest = type === 'request'
  const isResponse = type === 'response'
  const list = isRequest
    ? onRequestCallback
    : isResponse ? onResponseCallback : null

  if (list) {
    const nextCallback = list.filter((cb) => cb !== callback)
    isRequest
      ? (onRequestCallback = nextCallback)
      : isResponse ? (onResponseCallback = nextCallback)
      : null
  }
}

function baseRequestListener(request) {
  return request
}

function baseResponseListener(response) {
  return response
}

function callListeners(data, listeners) {
  const handle = listeners.reduce((preFn, nextFn) => (...args) => nextFn(preFn(...args)))
  return handle(data)
}

function subscribe(data, callbackList) {
  const innerObservable = data.innerObservable
  const nextData = withoutProperty(data, 'innerObservable')
  const finalData = callListeners(nextData, callbackList)
  innerObservable.next(finalData)
}

function subscribeWithReq(request) {
  subscribe(request, onRequestCallback)
}

function subscribeWithRes(response) {
  subscribe(response, onResponseCallback)
}

onRequest.subscribe(subscribeWithReq)
onResponse.subscribe(subscribeWithRes)


// INIT
on('request', baseRequestListener)
on('response', baseResponseListener)
// export api
const httpIntercept = { on, off }
window.httpIntercept = httpIntercept

/**
 * todo:
 * 
 * 1. Auto handle Cache.
 * 2. apply middleware.
 * 3. wait for async request/response intercept.
 * 
 */
