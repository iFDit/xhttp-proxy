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
class HttpReaderStream {
  
  constructor({ middleware, observerble }) {
    this.middleware = [].concat(middleware)
    this.observerble = observerble
      .map((req) => ({ request: req, error: null }))
  }

  applyMiddleware(fn) {
    this.middleware.push(fn)
  }

  createNext(subject, nextData) {
    return (err, nextReq) => {
      nextData.error = err
      nextData.data = nextReq
      subject.next()
    }
  }

  createSubscribeCallBack(middleware, next) {
    return ({ req, error }) => {
      try {
        middleware.call(this, error, req, next)
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
    const { next, subject, nextData, middleware } = handler
    ob.subscribe(this.createSubscribeCallBack(middleware, next))
    return ob
      .delayWhen((request) => subject)
      .map((preReq) => (!util.isEmpty(nextData) && nextData) || preReq)
  }

  initSubscribe() {
    const middlewares = this.middleware
    const handlers = middlewares.map(handleMiddleware)
    const observable = handlers.reduce(handleObservable, this.observerble)
    return observable
  }

  subscribe(fn) {
    const middlewares = this.middleware
    const observable = this.initSubscribe()
    observable.subscribe(fn)
  }
}


class HttpWriteStream {

}



