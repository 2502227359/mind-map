import { Loading } from 'element-ui'

let loadingInstance = null

export const createLoadingController = target => {
  let instance = null
  return {
    show() {
      if (instance) return
      instance = Loading.service({
        target,
        lock: false
      })
    },
    hide() {
      if (!instance) return
      instance.close()
      instance = null
    }
  }
}

export const showLoading = () => {
  if (loadingInstance) return
  loadingInstance = Loading.service({
    lock: true
  })
}

export const hideLoading = () => {
  if (loadingInstance) {
    loadingInstance.close()
    loadingInstance = null
  }
}
