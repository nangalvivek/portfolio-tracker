/* oxlint-disable react/only-export-components */
import {createElement, Fragment, type ChangeEvent, type MouseEvent as ReactMouseEvent, type ReactNode} from 'react'

const passthrough = (tag: keyof JSX.IntrinsicElements) => ({children}: {children?: ReactNode}) => createElement(tag, null, children)

const buttonLike = (Tag: keyof JSX.IntrinsicElements = 'button') => (
  {children, onPress, onClick, ...props}: {children?: ReactNode; onPress?: () => void; onClick?: () => void} & Record<string, unknown>
) =>
  createElement(
    Tag,
    {
      ...props,
      onClick: (event: ReactMouseEvent<HTMLElement>) => {
        event.preventDefault()
        onClick?.()
        onPress?.()
      },
    },
    children,
  )

const renderItems = ({children, items}: {children?: ReactNode | ((item: unknown) => ReactNode); items?: readonly unknown[]}) =>
  items && typeof children === 'function'
    ? items.map((item, index) => <Fragment key={index}>{(children as (item: unknown) => ReactNode)(item)}</Fragment>)
    : children

const requireA11yLabel = (name: string, props: {label?: string; 'aria-label'?: string; 'aria-labelledby'?: string}) => {
  if (!props.label && !props['aria-label'] && !props['aria-labelledby']) {
    throw new Error(`${name} requires a label or aria-label`)
  }
}

export const Provider = ({children}: {children?: ReactNode}) => createElement(Fragment, null, children)
export const defaultTheme = {}

export const Button = buttonLike('button')
export const ButtonGroup = passthrough('div')
export const ActionButton = Button
export const IllustratedMessage = passthrough('div')
export const Heading = passthrough('h2')
export const Content = passthrough('div')
export const Text = passthrough('span')
export const StatusLight = ({children}: {children?: ReactNode}) => createElement('span', null, children)
export const SearchField = ({value, onChange, ...props}: {value?: string; onChange?: (value: string) => void; label?: string; 'aria-label'?: string; 'aria-labelledby'?: string} & Record<string, unknown>) => {
  requireA11yLabel('SearchField', props)
  return createElement('input', {
    ...props,
    value: value ?? '',
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value),
  })
}
export const TextField = ({value, onChange, ...props}: {value?: string; onChange?: (value: string) => void; label?: string; 'aria-label'?: string; 'aria-labelledby'?: string} & Record<string, unknown>) => {
  requireA11yLabel('TextField', props)
  return createElement('input', {
    ...props,
    value: value ?? '',
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value),
  })
}
export const NumberField = ({value, onChange, ...props}: {value?: number; onChange?: (value: number | null) => void; label?: string; 'aria-label'?: string; 'aria-labelledby'?: string} & Record<string, unknown>) => {
  requireA11yLabel('NumberField', props)
  return createElement('input', {
    ...props,
    type: 'number',
    value: value ?? '',
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value === '' ? null : Number(event.target.value)),
  })
}
export const Picker = ({children, items, ...props}: {children?: ReactNode | ((item: unknown) => ReactNode); items?: readonly unknown[]; label?: string; 'aria-label'?: string; 'aria-labelledby'?: string} & Record<string, unknown>) => {
  requireA11yLabel('Picker', props)
  return createElement('div', props, renderItems({children, items}))
}
export const PickerItem = ({children}: {children?: ReactNode}) => createElement('div', null, children)
export const Tabs = ({children, ...props}: {children?: ReactNode; 'aria-label'?: string; 'aria-labelledby'?: string} & Record<string, unknown>) => {
  requireA11yLabel('Tabs', props)
  return createElement('div', props, children)
}
export const TabList = passthrough('div')
export const Tab = passthrough('div')
export const TabPanel = passthrough('div')
export const TableView = ({children, ...props}: {children?: ReactNode; 'aria-label'?: string; 'aria-labelledby'?: string} & Record<string, unknown>) => {
  requireA11yLabel('TableView', props)
  return createElement('table', props, children)
}
export const TableHeader = passthrough('thead')
export const TableBody = ({items, children, ...props}: {items?: readonly unknown[]; children?: (item: unknown) => ReactNode} & Record<string, unknown>) =>
  createElement('tbody', props, renderItems({children, items}))
export const Column = passthrough('th')
export const Row = passthrough('tr')
export const Cell = passthrough('td')
export const DropZone = passthrough('div')
export const FileTrigger = ({children}: {children?: ReactNode}) => createElement(Fragment, null, children)
