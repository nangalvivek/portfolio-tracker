/* oxlint-disable react/only-export-components */
import {createElement, type ReactNode} from 'react'

export const defaultTheme = {}
export const Provider = ({children}: {children: ReactNode}) => <>{children}</>

const passthrough = (Tag: keyof HTMLElementTagNameMap) => ({children, ...props}: {children?: ReactNode} & Record<string, unknown>) =>
  createElement(Tag, props, children)

export const View = passthrough('div')
export const Flex = passthrough('div')
export const Well = passthrough('section')
export const Heading = passthrough('h2')
export const Text = passthrough('span')
export const Content = passthrough('div')
export const IllustratedMessage = passthrough('div')
export const StatusLight = ({children}: {children?: ReactNode}) => <span>{children}</span>
export const Button = ({children, onPress, onClick, ...props}: {children?: ReactNode; onPress?: () => void; onClick?: () => void} & Record<string, unknown>) => (
  <button
    {...props}
    onClick={(event) => {
      event.preventDefault()
      onClick?.()
      onPress?.()
    }}
  >
    {children}
  </button>
)
export const ActionButton = Button
export const DropZone = passthrough('div')
export const FileTrigger = ({children}: {children?: ReactNode}) => <>{children}</>
export const SearchField = ({value, onChange, ...props}: {value?: string; onChange?: (value: string) => void} & Record<string, unknown>) => (
  <input {...props} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
)
export const TextField = SearchField
export const NumberField = ({value, onChange, ...props}: {value?: number; onChange?: (value: number | null) => void} & Record<string, unknown>) => (
  <input
    {...props}
    type="number"
    value={value ?? ''}
    onChange={(event) => onChange?.(event.target.value === '' ? null : Number(event.target.value))}
  />
)
export const Picker = ({children}: {children?: ReactNode} & Record<string, unknown>) => <div>{children}</div>
export const Item = ({children}: {children?: ReactNode}) => <div>{children}</div>
export const Tabs = passthrough('div')
export const TabList = passthrough('div')
export const TabPanels = passthrough('div')
export const TableView = passthrough('table')
export const TableHeader = passthrough('thead')
export const Column = passthrough('th')
export const TableBody = ({items, children, ...props}: {items?: readonly unknown[]; children?: (item: unknown) => ReactNode} & Record<string, unknown>) => (
  <tbody {...props}>
    {items?.map((item, index) => (
      <>{children ? children(item) : <tr key={index} />}</>
    ))}
  </tbody>
)
export const Row = passthrough('tr')
export const Cell = passthrough('td')
export const Tab = passthrough('div')
export const ButtonGroup = passthrough('div')
export const Disclosure = passthrough('div')
export const DisclosureGroup = passthrough('div')
export const DialogTrigger = passthrough('div')
export const AlertDialog = passthrough('div')
export const ActionGroup = passthrough('div')
export const Link = passthrough('a')
export const StatusLightIcon = passthrough('span')
