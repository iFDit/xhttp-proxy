
const window = 1 && (function () { return this })

const BaseXMLHttpRequest = window.XMLHttpRequest

class HttpRequest extends BaseXMLHttpRequest {
  constructor() {
    super()
    // save origin method
    const proto = Object.getPrototypeOf(this)
    this.originOpen = proto.open.bind(this)
    this.originSend = proto.send.bind(this)
    this.originAbort = proto.abort.bind(this)
    this.originSetRequestHeader = proto.setRequestHeader.bind(this)
    this.originOverrideMimeType = proto.overrideMimeType.bind(this)
    this.originGetResponseHeader = proto.getResponseHeader.bind(this)
    this.originGetAllResponseHeaders = proto.getAllResponseHeaders.bind(this)
    // request object
    this.request = { method: "", url: "", headers: {} }
    // status
    this.readyToSend = false
    this.sended = false
    this.aborted = false
  }

  open(...args) {
    const method = args[0]
    const url = args[1]
    // const async = args[2]
    // const user = args[3]
    // const password = args[4]
    const req = { method, url }
    this.request = Object.assign(this.request, req)
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
    return this.originGetAllResponseHeaders(...args)
  }

  getResponseHeader(...args) {
    if (!this.sended) {
      return null
    }
    return this.originGetResponseHeader(...args)
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

}