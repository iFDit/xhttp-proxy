const Rx = require('rxjs')
const util = require('../util')

const window = 1 && (function () { return this } ())
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
const transform = util.transform

class HttpRequest extends BaseXMLHttpRequest {
  constructor() {
    super()
    this.id = uniqueId()
    // bind
    this.onResponse = this.onResponse.bind(this)
    this.handleException = this.handleException.bind(this)
    // request object
    this.request = { method: "", url: "", headers: {}, data: null }
    // response object
    this.res = {
      status: 0,
      statusText: "",
      headers: {},
      data: null,
      request: null,
      url: null,
    }
    // status
    this.readyToSend = false
    this.sended = false
    this.aborted = false
    // events callbacks
    this.events = {}
    // inner Data
    this.config = { responseType: { from: "", to: null } }
    this._readystate = STATE['UNSENT']
  }

  originOpen(...args) {
    super.open(...args)
  }

  originSend(...args) {
    super.send(...args)
  }

  originAbort() {
    super.abort()
  }

  originSetRequestHeader(...args) {
    super.setRequestHeader(...args)
  }

  originOverrideMimeType(...args) {
    super.overrideMimeType(...args)
  }

  originGetResponseHeader(...args) {
    return super.getResponseHeader(...args)
  }

  originGetAllResponseHeaders(...args) {
    try {
      return super.getAllResponseHeaders(...args)
    } catch(e) {
      return null
    }
  }

  open(...args) {
    const method = args[0]
    const url = args[1]
    const req = { method, url }
    this.request = Object.assign(this.request, req)
  }

  abort(...args) {
    if (this.sended) {
      this.originAbort(...args)
    }
    this.aborted = true
  }

  handleException() {
    xhrReqObservable$.next({
      ...this.res,
      meta: { ctx: this, type: indicate, id: this.id },
      exception: true
    })
  }

  getAllResponseHeaders(...args) {
    if (!this.sended) {
      return null
    }
    return this.decodeHeaders(this.res.headers)
  }

  getResponseHeader(...args) {
    if (!this.sended) {
      return null
    }
    const key = (args[0] || '').toLowerCase()
    return this.res.headers[key] || null
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
    super.onreadystatechange = this.onResponse
    this.mergeResponse({ request: Object.assign({}, this.request) })
    xhrReqObservable$.next({
      ...this.request,
      data: arg,
      meta: { ctx: this, type: indicate, id: this.id },
    })
  }

  onResponse() {
    const readystate = super.readyState

    if (readystate == STATE['DONE']) {
      return this.onLoad(STATE['DONE'])
    }
    if (readystate === STATE['LOADING']) {
      return this.onLoad(STATE['LOADING'])
    }
    if (readystate === STATE['HEADERS_RECEIVED']) {
      return this.onSend()
    }
  }

  onSend() {
    const status = super.status
    const url = super.responseURL
    const statusText = super.statusText
    const headers = this.formatHeaders(super.getAllResponseHeaders())
    const res = { status, url, headers, statusText }
    xhrResObservable$.next({
      ...Object.assign(this.res, res),
      meta: { ctx: this, type: indicate, id: this.id },
      readystate: STATE['HEADERS_RECEIVED'],
    })
  }

  onLoad(readystate) {
    const res = { data: this.getResponseData() }
    // this.response = Object.assign(this.response, res)
    xhrResObservable$.next({
      ...Object.assign(this.res, res),
      // ...this.res,
      meta: { ctx: this, type: indicate, id: this.id },
      readystate,
    })
  }

  triggerEvent(type, ...args) {
    if (Array.isArray(this.events[type])) {
      this.events[type].forEach((fn) => fn.apply(this, args))
    }
  }

  mergeRequest(nextReq) {
    this.request = Object.assign(this.request, nextReq)
  }

  mergeResponse(nextRes) {
    this.res = Object.assign(this.res, nextRes)
  }

  changestate(nextstate) {
    this._readystate = nextstate
  }

  getResponseData() {
    const type = this.config['responseType']
    const isText = !type.from || type.from === 'text'
    const isArraybuf = type.from === 'arraybuffer'

    if (isText) {
      return this.transformText(type.to)
    }
    if (isArraybuf) {
      return this.transformArrayBuffer(type.to)
    }
    return super.response
  }

  transformText(to) {
    if (to === 'json') {
      return transform.s2j(super.responseText)
    }
    if (to === 'document') {
      return transform.s2doc(super.responseText)
    }
    if (to === 'arraybuffer') {
      return transform.s2ab(super.responseText)
    }
    if (to === 'blob') {
      return transform.s2b(super.responseText)
    }
    return super.responseText
  }

  transformArrayBuffer(to) {
    const contentType = this.res.headers['content-type']
    const toText = to === 'text' || /text\/plain/g.test(contentType)
    if (toText) {
      return transform.ab2s(super.response)
    }
    if (to === 'json') {
      const str = transform.ab2s(super.response)
      return transform.s2j(str)
    }
    if (to === 'document') {
      const str = transform.ab2s(super.response)
      return transform.s2doc(str)
    }
    if (to === 'blob') {
      const str = transform.ab2s(super.response)
      return transform.s2b(str)
    }
    return super.response
  }

  formatHeaders(headers) {
    const arr = headers.trim().split(/[\r\n]+/)
    const headerMap = {}
    arr.forEach(function (line) {
      var parts = line.split(': ')
      var header = (parts.shift() || '').toLowerCase()
      var value = parts.join(': ')
      headerMap[header] = value
    })
    return headerMap
  }

  decodeHeaders(headers) {
    const keys = Object.keys(headers)
    return keys.map((key) => {
      const line = `${key}: ${headers[key] || ''}`
      return line
    }).join('\r\n')
  }

  get readyState() {
    return this._readystate
  }

  get status() {
    return this.res.status
  }

  get statusText() {
    return this.res.statusText
  }

  get response() {
    return this.res.data
  }

  get responseText() {
    return this.res.data
  }

  get responseURL() {
    return this.res.url
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
      super.onreadystatechange = this.onResponse
    }
  }

  get responseType() {
    return this.config['responseType'].to === null
      ? this.config['responseType'].from
      : this.config['responseType'].to
  }

  set responseType(type) {
    if (this._readystate === 0 || this._readystate === 1) {
      this.config['responseType'].from = type
    } else {
      this.config['responseType'].to = type
    }
    try {
      super.responseType = type
    } catch(e) {}
  }

}

function enable() {
  window.XMLHttpRequest = HttpRequest
}

function disable() {
  window.XMLHttpRequest = BaseXMLHttpRequest
}

module.exports = {
  STATE,
  enable,
  disable,
  xhrReqObservable$,
  xhrResObservable$,
}
