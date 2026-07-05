/* oxlint-disable react/only-export-components */
import {ButtonGroup, Content, Heading, IllustratedMessage, StatusLight, Text} from '@react-spectrum/s2'
import {style, space} from '@react-spectrum/s2/style' with {type: 'macro'}
import NoElementsIllustration from '@react-spectrum/s2/illustrations/gradient/generic1/NoElements'
import SearchIllustration from '@react-spectrum/s2/illustrations/gradient/generic1/Search'
import DropToUploadIllustration from '@react-spectrum/s2/illustrations/gradient/generic1/DropToUpload'
import type {ReactElement, ReactNode} from 'react'
import type {StyleString} from '@react-spectrum/s2/style'

const panelStyle: string = style({
  padding: space(20),
  borderRadius: 'default',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'layer-1',
  boxShadow: 'elevated'
})

const pageHeaderStyle: string = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'start',
  gap: space(24),
  flexWrap: 'wrap'
})

const pageHeaderTextStyle: string = style({
  display: 'grid',
  gap: space(4),
  minWidth: 0
})

const pageTitleStyle = style({
  marginTop: 0,
  marginBottom: 0
})

const actionGroupStyle: string = style({
  display: 'flex',
  gap: space(8),
  flexWrap: 'wrap',
  justifyContent: 'end'
})

const sectionTitleStyle: string = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'start',
  gap: space(16),
  flexWrap: 'wrap',
  marginBottom: space(12)
})

const sectionTitleTextStyle: string = style({
  display: 'grid',
  gap: space(4),
  minWidth: 0
})

const metricCardStyle: string = style({
  padding: space(20),
  borderRadius: 'default',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'layer-1',
  boxShadow: 'elevated',
  minHeight: space(128),
  display: 'grid',
  gap: space(10),
  alignContent: 'space-between'
})

const metricLabelStyle: string = style({
  color: 'gray-600',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 'bold',
  fontSize: 'body-xs'
})

export const secondaryTextStyle: string = style({color: 'gray-600'})

export const toStyleString = (value: string): StyleString => value as unknown as StyleString

const emptyStateRegionStyle: string = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: '100%',
  textAlign: 'center'
})

export const Panel = ({children}: {children: ReactNode}) => <div className={panelStyle}>{children}</div>

export const PageHeader = ({title, actions}: {title: string; actions?: ReactNode}) => (
  <div className={pageHeaderStyle}>
    <div className={pageHeaderTextStyle}>
      <Heading level={1} styles={pageTitleStyle}>{title}</Heading>
    </div>
    {actions ? <div className={actionGroupStyle}>{actions}</div> : null}
  </div>
)

export const SectionTitle = ({title, subtitle, actions}: {title: string; subtitle?: string; actions?: ReactNode}) => (
  <div className={sectionTitleStyle}>
    <div className={sectionTitleTextStyle}>
      <Heading level={2}>{title}</Heading>
      {subtitle ? <Text styles={toStyleString(secondaryTextStyle)}>{subtitle}</Text> : null}
    </div>
    {actions ? <div className={actionGroupStyle}>{actions}</div> : null}
  </div>
)

export const EmptyStateIllustrations = {
  generic: NoElementsIllustration,
  search: SearchIllustration,
  upload: DropToUploadIllustration
} as const

export const EmptyState = ({
  title,
  description,
  action,
  illustration,
}: {
  title: string
  description: string
  action?: ReactNode
  illustration?: ReactElement
}) => (
  <div className={emptyStateRegionStyle}>
    <IllustratedMessage size="L">
      {illustration ?? <NoElementsIllustration />}
      <Heading>{title}</Heading>
      <Content>{description}</Content>
      {action ? <ButtonGroup>{action}</ButtonGroup> : null}
    </IllustratedMessage>
  </div>
)

export const MetricCard = ({label, value}: {label: string; value: string}) => (
  <div className={metricCardStyle}>
    <Text styles={toStyleString(metricLabelStyle)}>{label}</Text>
    <Heading level={2}>{value}</Heading>
  </div>
)

export const StatusBadge = ({value}: {value: 'NEW' | 'DUPLICATE' | 'ERROR' | 'OK' | 'Partial' | 'positive' | 'notice' | 'negative' | 'neutral'}) => {
  const variant = value === 'NEW' || value === 'OK' || value === 'positive'
    ? 'positive'
    : value === 'DUPLICATE' || value === 'Partial' || value === 'notice'
      ? 'notice'
      : value === 'ERROR' || value === 'negative'
        ? 'negative'
        : 'neutral'
  return <StatusLight variant={variant}>{value}</StatusLight>
}

export const pageStackStyle: string = style({display: 'grid', gap: space(24), minHeight: '100%', flex: '1 1 auto'})
export const pageSectionGridStyle: string = style({display: 'grid', gap: space(20)})
export const pageTwoColumnGridStyle: string = style({display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(18rem, 1fr)', gap: space(20)})
export const pageMetricGridStyle: string = style({display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: space(16)})
export const pageToolbarStyle: string = style({display: 'flex', gap: space(8), flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between'})
export const pageStackedToolbarStyle: string = style({display: 'flex', gap: space(8), flexWrap: 'wrap'})
export const pageEmptyRegionStyle: string = style({display: 'flex', minHeight: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', paddingBlock: space(32)})
export const pageContentGridStyle: string = style({display: 'grid', gap: space(20)})
export const pageCompactGridStyle: string = style({display: 'grid', gap: space(12)})
export const pageMonoTextStyle: string = style({fontFamily: 'code'})
