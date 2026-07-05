export const downloadText = (filename: string, text: string, mimeType = 'application/json'): void => {
  const blob = new Blob([text], { type: mimeType })
  downloadBlob(filename, blob)
}

export const downloadBlob = (filename: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
