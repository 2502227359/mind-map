import * as XLSX from 'xlsx'
import {
  mindMapToExcelTable,
  excelTableToMindMap
} from 'simple-mind-map/src/parse/excel.js'

const getFirstSheet = workbook => {
  const sheetName = workbook && workbook.SheetNames ? workbook.SheetNames[0] : ''
  if (!sheetName) throw new Error('Excel 文件没有工作表')
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('Excel 首个工作表不存在')
  return sheet
}

const readInput = async input => {
  if (input && typeof input.arrayBuffer === 'function') {
    return input.arrayBuffer()
  }
  if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) return input
  throw new TypeError('Excel 输入必须是文件、ArrayBuffer 或 Uint8Array')
}

// 生成 xlsx 工作簿。导出层只使用宿主已有的 xlsx 依赖，不让核心引擎引入新依赖。
export const createExcelWorkbook = data => {
  const table = mindMapToExcelTable(data)
  const sheet = XLSX.utils.aoa_to_sheet(table)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '思维导图')
  return workbook
}

export const exportExcel = (data, options = {}) => {
  const workbook = createExcelWorkbook(data)
  const output = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: options.type || 'array',
    compression: true
  })
  if (options.type === 'buffer') return output
  return new Blob([output], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
}

export const importExcel = async input => {
  const source = await readInput(input)
  const workbook = XLSX.read(source, { type: 'array' })
  const sheet = getFirstSheet(workbook)
  const table = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ''
  })
  return excelTableToMindMap(table)
}

export default {
  createExcelWorkbook,
  exportExcel,
  importExcel
}
