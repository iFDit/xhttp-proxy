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
  )
    .then(assign)
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
    const url = request
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
    const url = args.length > 1 ? args[0] : _.get(args[0], 'url', null)
    const request = Object.assign({}, args[1] || {}, { url })
    onRequest.next(Object.assign({}, request, { innerObservable }))
    return getReq(innerObservable, request)
      .then(handleFetchReq)
      .then(handleFetchRes)
  }
}

if (window.XMLHttpRequest) {
  const BaseXMLHttpRequest = window.XMLHttpRequest
  let request = {}
  window.XMLHttpRequest = class extends BaseXMLHttpRequest {
    constructor() {
      super()
      this.beSend = false
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
        for ( header in restReq) {
          this.setRequestHeader(header, restReq[header])
        }
        super.send(...args)
      }
      onRequest.next(Object.assign({}, request, { innerObservable }))
      getReq(innerObservable, request)
        .then(handleSendReq)
    }
  }
}

function on(type, callback) {
  if (type === 'request') {
    onRequestCallback.push(callback)
  }

  if (type === 'response') {
    onResponseCallback.push(callback)
  }
}

function off(type, callback) {
  const nextCallback = onRequestCallback.filter((cb) => cb !== callback)
  onRequestCallback = nextCallback
}

function baseRequestListener(request) {
  return request
}

function baseResponseListener(response) {
  return response
}

function callListeners(data, listeners) {
  const handle = listeners.reduce((preFn, nextFn) => (...args) => nextFn(preFn(args)))
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
  subscribe(request, onResponseCallback)
}

onRequest.subscribe(subscribeWithReq)
onResponse.subscribe(subscribeWithRes)


// export api
const httpIntercept = { on, off }
window.httpIntercept = httpIntercept
