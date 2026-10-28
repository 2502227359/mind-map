import Vue from 'vue'
import VueI18n from 'vue-i18n'
import messages from './lang'

Vue.use(VueI18n)

export const createI18n = (locale = 'en') => {
  return new VueI18n({
    locale,
    messages,
    fallbackLocale: 'en'
  })
}

export default createI18n
