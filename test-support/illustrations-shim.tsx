/* oxlint-disable react/only-export-components */
import {createElement, type ReactNode} from 'react'

const illustration = (_name: string) => ({children, ...props}: {children?: ReactNode} & Record<string, unknown>) =>
  createElement('div', props, children)

export default illustration('Illustration')
export const NotFound = illustration('NotFound')
export const NoSearchResults = illustration('NoSearchResults')
export const Upload = illustration('Upload')
