const Rx = require('rxjs')
const util = require('../util')

const window = 1 && (function () { return this })
const BaseXMLHttpRequest = window.XMLHttpRequest
const xhrReqObservable$ = new Rx.Subject()
const xhrResObservable$ = new Rx.Subject()
const indicate = 'XHR'
const STATE = {
  UNSENT: 0,
  OPENED: 1,
  HEADERS_RECEIVED: 2,
  LOADING: 3,
  DONE: 4,
}

// util
const has = util.has
const noop = util.noop
const uniqueId = util.uniqueId
const returnNull = util.returnNull

class HttpRequest extends BaseXMLHttpRequest {
  constructor() {
    super()
    this.id = uniqueId()
    // save origin method
    const proto = Object.getPrototypeOf(this)
    this.originOpen = proto.open.bind(this)
    this.originSend = proto.send.bind(this)
    this.originAbort = has(proto, 'abort')
      ? proto.abort.bind(this)
      : noop
    this.originSetRequestHeader = has(proto, 'setRequestHeader')
      ? proto.setRequestHeader.bind(this)
      : noop
    this.originOverrideMimeType = has(proto, 'overrideMimeType')
      ? proto.overrideMimeType.bind(this)
      : noop
    this.originGetResponseHeader = has(proto, 'getResponseHeader')
      ? proto.getResponseHeader.bind(this)
      : returnNull
    this.originGetAllResponseHeaders = has(proto, 'getAllResponseHeaders')
      ? proto.getAllResponseHeaders.bind(this)
      : returnNull
    // bind
    this.onResponse = this.onResponse.bind(this)
    // request object
    this.request = { method: "", url: "", headers: {}, data: null }
    // response object
    this.response = {
      status: 0,
      statusText: "",
      headers: {},
      data: null,
      requrl: null,
      resurl: null,
    }
    // status
    this.readyToSend = false
    this.sended = false
    this.aborted = false
    // events callbacks
    this.events = {}
    // inner Data
    this.config = { responseType: '' }
    this._readystate = 0
  }

  open(...args) {
    const method = args[0]
    const url = args[1]
    // const async = args[2]
    // const user = args[3]
    // const password = args[4]
    const req = { method, url }
    this.request = Object.assign(this.request, req)
    this.response = Object.assign(this.response, { requrl: url })
  }

  abort(...args) {
    if (this.sended) {
      this.originAbort(...args)
    }
    this.aborted = true
  }

  getAllResponseHeaders(...args) {
    if (!this.sended) {
      return null
    }
    return this.response.headers
  }

  getResponseHeader(...args) {
    if (!this.sended) {
      return null
    }
    const key = args[0]
    return this.response.headers[key] || null
  }

  overrideMimeType(...args) {
    if (this.send) { return }
    this.originOverrideMimeType(...args)
  }

  setRequestHeader(...args) {
    const key = args[0]
    const value = args[1]
    const headers = this.request.headers
    headers[key] = value
    this.request = Object.assign(this.request, { headers })
  }

  send(arg) {
    this.readyToSend = true
    xhrReqObservable$.next({
      ...this.request,
      data: arg,
      meta: { ctx: this, type: indicate, id: this.id },
    })
  }

  onResponse() {
    const readystate = super.readyState
    const handles = this.events.statechange
    if (readystate == STATE['DONE']) {
      return this.onLoad(STATE['DONE'])
    }
    if (readystate === STATE['LOADING']) {
      return this.onLoad(STATE['LOADING'])
    }
    if (readystate === STATE['HEADERS_RECEIVED']) {
      return this.onSend()
    }
    this._readystate = readystate
    handles.forEach((handle) => handle.call(this))
  }

  onSend() {
    const status = super.status
    const resurl = super.responseURL
    const statusText = super.statusText
    const headers = this.getAllResponseHeaders()
    const res = { status, resurl, headers, statusText }
    // this.response = Object.assign(this.response, res)
    xhrResObservable$.next({
      ...Object.assign(this.response, res),
      meta: { ctx: this, type: indicate, id: this.id },
      readystate: STATE['HEADERS_RECEIVED'],
    })
  }

  onLoad(readystate) {
    const res = { data: this.getResponseData() }
    // this.response = Object.assign(this.response, res)
    xhrResObservable$.next({
      ...Object.assign(this.response, res),
      meta: { ctx: this, type: indicate, id: this.id },
      readystate,
    })
  }

  triggerEvent(type, ...args) {
    if (Array.isArray(this.events[type])) {
      this.events[type].forEach((fn) => fn.apply(this, args))
    }
  }

  mergeRespose(nextRes) {
    this.response = Object.assign(this.response, nextRes)
  }

  getResponseData() {
    const type = this.config['responseType']
    return !type || type === 'text' ? super.responseText : super.response
  }

  get readystate() {
    return this._readystate
  }

  get status() {
    return this.response.status
  }

  get statusText() {
    return this.response.statusText
  }

  get response() {
    return this.response.data
  }

  get responseText() {
    return this.response.data
  }

  get responseURL() {
    return this.response.resurl
  }

  get onreadystatechange() {
    return super.onreadystatechange
  }

  set onreadystatechange(fn) {
    const handles = this.events.statechange || (this.events.statechange = [])
    const firstFn = this.events.statechange[0]
    const rootFn = this.onreadystatechange
    if (firstFn) {
      this.events.statechange[0] = fn
    } else {
      this.events.statechange.unshift(fn)
    }
    if (!rootFn) {
      super.onreadystatechange = function () { /* todo */ }
    }
  }

  get responseType() {
    return super.responseType
  }

  set responseType(type) {
    this.config['responseType'] = type
    super.responseType = type
  }

}

module.exports = {
  STATE,

}