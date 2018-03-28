const Rx = require('rxjs')
const _ = require('lodash')
const util = require('./util')

/**
 * register all http interceptor.
 * 
 * @param {object} config
 * 
 * configure include cache strategy, error handle.
 * 
 */
export function enable(config) {

}

/**
 * repristination.
 */
export function disable() {

}

/**
 * http type:
 * 
 * Todo:
 *  tags http: <img />, <script />, <style />, <iframe />, <form />.
 *  style import http.
 *  style url resource reference.
 * 
 * Done:
 *  xhr request: XMLHttprequest.
 *  fetch request: fetch.
 * 
 */
class HttpStream {
  
  constructor({ middleware, observable$ }) {
    this.subscribeFn = null
    this.middleware = middleware ? [].concat(middleware) : []
    this.observable$ = observable$
      .map((data) => ({ data, error: null }))
    // bind context
    this.handleMiddleware = this.handleMiddleware.bind(this)
    this.handleObservable = this.handleObservable.bind(this)
    this.createSubscribeCallBack = this.createSubscribeCallBack.bind(this)
  }

  applyMiddleware(fn) {
    this.middleware.push(fn)
    this.refreshMiddleware()
    return this.middleware.length
  }

  delectMiddleware(index) {
    if (typeof index !== 'number') {
      return
    }
    this.moddleware.splice(index || 0, 1)
    this.refreshMiddleware()
  }

  subscribe(fn) {
    const middlewares = this.middleware
    const observable$ = this.initSubscribe()
    this.subscribeFn = fn
    observable$.subscribe(fn)
    return observable$
  }

  refreshMiddleware() {
    if (this.subscribeFn) {
      this.subscribe(this.subscribeFn)
    }
  }

  createNext(subject, nextData) {
    return (err, data) => {
      nextData.error = err
      nextData.data = data
      subject.next()
    }
  }

  createSubscribeCallBack(middleware, next) {
    return ({ data, error }) => {
      try {
        middleware.call(this, error, data, next)
      } catch(e) {
        next(e, null)
      }
    }
  }

  handleMiddleware(middleware) {
    const nextData = {}
    const subject = new Rx.Subject()
    const next = this.createNext(subject, nextData)
    return { next, subject, nextData, middleware }
  }

  handleObservable(ob, handler) {
    let meta = null
    const { next, subject, nextData, middleware } = handler
    ob.map(({ data, error }) => {
      meta = data && data.meta
      return {
        data: util.without(data, 'meta'),
        error,
      }
    }).subscribe(this.createSubscribeCallBack(middleware, next))
    return ob
      .delayWhen((request) => subject)
      .map((preReq) => (!util.isEmpty(nextData) && nextData) || preReq)
      .map(({ data, error }) =>
        data.meta
          ? { data, error }
          : { error, data, meta }
      )
  }

  initSubscribe() {
    const middlewares = this.middleware
    const handlers = middlewares.map(this.handleMiddleware)
    const observable$ = handlers.reduce(this.handleObservable, this.observable$)
    return observable$
  }

}

class HttpReadStream extends HttpStream {
  constructor({ type, ...rest }) {
    super(rest)
    this.type = type
  }
}

class HttpWriteStream extends HttpStream {
  constructor({ type, ...rest }) {
    super(rest)
    this.type = type
  }
}

