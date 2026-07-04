/* oxlint-disable react/only-export-components */
import {createElement, Fragment, type ReactNode} from 'react'

const passthrough = (tag: keyof JSX.IntrinsicElements) => ({children}: {children?: ReactNode}) =>
  createElement(tag, null, children)

export const Provider = ({children}: {children?: ReactNode}) => createElement(Fragment, null, children)
export const IllustratedMessage = passthrough('div')
export const Heading = passthrough('h2')
export const Content = passthrough('p')
export const ButtonGroup = passthrough('div')
export const Button = passthrough('button')
