/*
 * LZ-String 1.4.4
 * Copyright (c) 2013 Pieroxy
 * MIT License. See plugin/THIRD_PARTY_NOTICES.md.
 * Source: https://github.com/pieroxy/lz-string
 */
'use strict'

const LZString = (() => {
  const fromCharCode = String.fromCharCode
  const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  const uriAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$'
  const indexes = {}

  function getBaseValue(alphabet, character) {
    if (!indexes[alphabet]) {
      indexes[alphabet] = {}
      for (let index = 0; index < alphabet.length; index += 1) {
        indexes[alphabet][alphabet.charAt(index)] = index
      }
    }
    return indexes[alphabet][character]
  }

  return {
    compressToBase64(input) {
      if (input == null) return ''
      const result = this._compress(input, 6, value => base64Alphabet.charAt(value))
      switch (result.length % 4) {
        case 0: return result
        case 1: return `${result}===`
        case 2: return `${result}==`
        default: return `${result}=`
      }
    },

    decompressFromBase64(input) {
      if (input == null) return ''
      if (input === '') return null
      return this._decompress(input.length, 32, index => getBaseValue(base64Alphabet, input.charAt(index)))
    },

    _compress(input, bitsPerCharacter, getCharacter) {
      if (input == null) return ''
      let value
      const dictionary = {}
      const dictionaryToCreate = {}
      let current = ''
      let currentAndNext = ''
      let character = ''
      let enlargeIn = 2
      let dictionarySize = 3
      let numberOfBits = 2
      const data = []
      let dataValue = 0
      let dataPosition = 0

      for (let index = 0; index < input.length; index += 1) {
        character = input.charAt(index)
        if (!Object.prototype.hasOwnProperty.call(dictionary, character)) {
          dictionary[character] = dictionarySize
          dictionarySize += 1
          dictionaryToCreate[character] = true
        }

        currentAndNext = current + character
        if (Object.prototype.hasOwnProperty.call(dictionary, currentAndNext)) {
          current = currentAndNext
          continue
        }

        if (Object.prototype.hasOwnProperty.call(dictionaryToCreate, current)) {
          if (current.charCodeAt(0) < 256) {
            for (let bit = 0; bit < numberOfBits; bit += 1) {
              dataValue <<= 1
              if (dataPosition === bitsPerCharacter - 1) {
                dataPosition = 0
                data.push(getCharacter(dataValue))
                dataValue = 0
              } else {
                dataPosition += 1
              }
            }
            value = current.charCodeAt(0)
            for (let bit = 0; bit < 8; bit += 1) {
              dataValue = (dataValue << 1) | (value & 1)
              if (dataPosition === bitsPerCharacter - 1) {
                dataPosition = 0
                data.push(getCharacter(dataValue))
                dataValue = 0
              } else {
                dataPosition += 1
              }
              value >>= 1
            }
          } else {
            value = 1
            for (let bit = 0; bit < numberOfBits; bit += 1) {
              dataValue = (dataValue << 1) | value
              if (dataPosition === bitsPerCharacter - 1) {
                dataPosition = 0
                data.push(getCharacter(dataValue))
                dataValue = 0
              } else {
                dataPosition += 1
              }
              value = 0
            }
            value = current.charCodeAt(0)
            for (let bit = 0; bit < 16; bit += 1) {
              dataValue = (dataValue << 1) | (value & 1)
              if (dataPosition === bitsPerCharacter - 1) {
                dataPosition = 0
                data.push(getCharacter(dataValue))
                dataValue = 0
              } else {
                dataPosition += 1
              }
              value >>= 1
            }
          }
          enlargeIn -= 1
          if (enlargeIn === 0) {
            enlargeIn = 2 ** numberOfBits
            numberOfBits += 1
          }
          delete dictionaryToCreate[current]
        } else {
          value = dictionary[current]
          for (let bit = 0; bit < numberOfBits; bit += 1) {
            dataValue = (dataValue << 1) | (value & 1)
            if (dataPosition === bitsPerCharacter - 1) {
              dataPosition = 0
              data.push(getCharacter(dataValue))
              dataValue = 0
            } else {
              dataPosition += 1
            }
            value >>= 1
          }
        }
        enlargeIn -= 1
        if (enlargeIn === 0) {
          enlargeIn = 2 ** numberOfBits
          numberOfBits += 1
        }
        dictionary[currentAndNext] = dictionarySize
        dictionarySize += 1
        current = String(character)
      }

      if (current !== '') {
        if (Object.prototype.hasOwnProperty.call(dictionaryToCreate, current)) {
          if (current.charCodeAt(0) < 256) {
            for (let bit = 0; bit < numberOfBits; bit += 1) {
              dataValue <<= 1
              if (dataPosition === bitsPerCharacter - 1) {
                dataPosition = 0
                data.push(getCharacter(dataValue))
                dataValue = 0
              } else {
                dataPosition += 1
              }
            }
            value = current.charCodeAt(0)
            for (let bit = 0; bit < 8; bit += 1) {
              dataValue = (dataValue << 1) | (value & 1)
              if (dataPosition === bitsPerCharacter - 1) {
                dataPosition = 0
                data.push(getCharacter(dataValue))
                dataValue = 0
              } else {
                dataPosition += 1
              }
              value >>= 1
            }
          } else {
            value = 1
            for (let bit = 0; bit < numberOfBits; bit += 1) {
              dataValue = (dataValue << 1) | value
              if (dataPosition === bitsPerCharacter - 1) {
                dataPosition = 0
                data.push(getCharacter(dataValue))
                dataValue = 0
              } else {
                dataPosition += 1
              }
              value = 0
            }
            value = current.charCodeAt(0)
            for (let bit = 0; bit < 16; bit += 1) {
              dataValue = (dataValue << 1) | (value & 1)
              if (dataPosition === bitsPerCharacter - 1) {
                dataPosition = 0
                data.push(getCharacter(dataValue))
                dataValue = 0
              } else {
                dataPosition += 1
              }
              value >>= 1
            }
          }
          enlargeIn -= 1
          if (enlargeIn === 0) {
            enlargeIn = 2 ** numberOfBits
            numberOfBits += 1
          }
          delete dictionaryToCreate[current]
        } else {
          value = dictionary[current]
          for (let bit = 0; bit < numberOfBits; bit += 1) {
            dataValue = (dataValue << 1) | (value & 1)
            if (dataPosition === bitsPerCharacter - 1) {
              dataPosition = 0
              data.push(getCharacter(dataValue))
              dataValue = 0
            } else {
              dataPosition += 1
            }
            value >>= 1
          }
        }
        enlargeIn -= 1
        if (enlargeIn === 0) {
          enlargeIn = 2 ** numberOfBits
          numberOfBits += 1
        }
      }

      value = 2
      for (let bit = 0; bit < numberOfBits; bit += 1) {
        dataValue = (dataValue << 1) | (value & 1)
        if (dataPosition === bitsPerCharacter - 1) {
          dataPosition = 0
          data.push(getCharacter(dataValue))
          dataValue = 0
        } else {
          dataPosition += 1
        }
        value >>= 1
      }

      while (true) {
        dataValue <<= 1
        if (dataPosition === bitsPerCharacter - 1) {
          data.push(getCharacter(dataValue))
          break
        }
        dataPosition += 1
      }
      return data.join('')
    },

    _decompress(length, resetValue, getNextValue) {
      const dictionary = []
      let next
      let enlargeIn = 4
      let dictSize = 4
      let numBits = 3
      let entry = ''
      const result = []
      let bits
      let resb
      let maxpower
      let power
      const data = { val: getNextValue(0), position: resetValue, index: 1 }

      for (let index = 0; index < 3; index += 1) dictionary[index] = index
      bits = 0
      maxpower = 2 ** 2
      power = 1
      while (power !== maxpower) {
        resb = data.val & data.position
        data.position >>= 1
        if (data.position === 0) {
          data.position = resetValue
          data.val = getNextValue(data.index++)
        }
        bits |= (resb > 0 ? 1 : 0) * power
        power <<= 1
      }

      switch (next = bits) {
        case 0:
          bits = 0
          maxpower = 2 ** 8
          power = 1
          while (power !== maxpower) {
            resb = data.val & data.position
            data.position >>= 1
            if (data.position === 0) {
              data.position = resetValue
              data.val = getNextValue(data.index++)
            }
            bits |= (resb > 0 ? 1 : 0) * power
            power <<= 1
          }
          entry = fromCharCode(bits)
          break
        case 1:
          bits = 0
          maxpower = 2 ** 16
          power = 1
          while (power !== maxpower) {
            resb = data.val & data.position
            data.position >>= 1
            if (data.position === 0) {
              data.position = resetValue
              data.val = getNextValue(data.index++)
            }
            bits |= (resb > 0 ? 1 : 0) * power
            power <<= 1
          }
          entry = fromCharCode(bits)
          break
        case 2:
          return ''
        default:
          return ''
      }

      dictionary[3] = entry
      let w = entry
      result.push(entry)

      while (true) {
        if (data.index > length) return ''
        bits = 0
        maxpower = 2 ** numBits
        power = 1
        while (power !== maxpower) {
          resb = data.val & data.position
          data.position >>= 1
          if (data.position === 0) {
            data.position = resetValue
            data.val = getNextValue(data.index++)
          }
          bits |= (resb > 0 ? 1 : 0) * power
          power <<= 1
        }

        switch (next = bits) {
          case 0:
            bits = 0
            maxpower = 2 ** 8
            power = 1
            while (power !== maxpower) {
              resb = data.val & data.position
              data.position >>= 1
              if (data.position === 0) {
                data.position = resetValue
                data.val = getNextValue(data.index++)
              }
              bits |= (resb > 0 ? 1 : 0) * power
              power <<= 1
            }
            dictionary[dictSize++] = fromCharCode(bits)
            next = dictSize - 1
            enlargeIn -= 1
            break
          case 1:
            bits = 0
            maxpower = 2 ** 16
            power = 1
            while (power !== maxpower) {
              resb = data.val & data.position
              data.position >>= 1
              if (data.position === 0) {
                data.position = resetValue
                data.val = getNextValue(data.index++)
              }
              bits |= (resb > 0 ? 1 : 0) * power
              power <<= 1
            }
            dictionary[dictSize++] = fromCharCode(bits)
            next = dictSize - 1
            enlargeIn -= 1
            break
          case 2:
            return result.join('')
        }

        if (enlargeIn === 0) {
          enlargeIn = 2 ** numBits
          numBits += 1
        }
        if (dictionary[next]) {
          entry = dictionary[next]
        } else if (next === dictSize) {
          entry = w + w.charAt(0)
        } else {
          return null
        }
        result.push(entry)
        dictionary[dictSize++] = w + entry.charAt(0)
        w = entry
        enlargeIn -= 1
        if (enlargeIn === 0) {
          enlargeIn = 2 ** numBits
          numBits += 1
        }
      }
    }
  }
})()

module.exports = LZString
