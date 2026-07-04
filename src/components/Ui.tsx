/* oxlint-disable react/only-export-components */
import {Content, Flex, Heading, IllustratedMessage, StatusLight, Text, View, Well} from '@adobe/react-spectrum'
import NotFoundIllustration from '@spectrum-icons/illustrations/NotFound'
import NoSearchResultsIllustration from '@spectrum-icons/illustrations/NoSearchResults'
import UploadIllustration from '@spectrum-icons/illustrations/Upload'
import {cloneElement, type ReactElement, type ReactNode} from 'react'

export const Panel = ({children}: {children: ReactNode}) => (
  <Well
    UNSAFE_style={{
      padding: '20px',
      border: '1px solid var(--spectrum-global-color-gray-200)',
      boxShadow: '0 1px 2px color-mix(in srgb, var(--spectrum-global-color-gray-900) 8%, transparent)',
      borderRadius: 'var(--spectrum-alias-border-radius-medium)',
      background: 'var(--spectrum-global-color-gray-50)',
    }}
  >
    {children}
  </Well>
)

export const PageHeader = ({title, subtitle, actions}: {title: string; subtitle?: string; actions?: ReactNode}) => (
  <Flex justifyContent="space-between" alignItems="start" gap="size-300" UNSAFE_style={{marginBottom: '8px'}}>
    <View>
      <Heading level={1} margin={0}>
        {title}
      </Heading>
      {subtitle ? <Text UNSAFE_style={{color: 'var(--spectrum-alias-text-color-secondary)'}}>{subtitle}</Text> : null}
    </View>
    {actions ? <Flex gap="size-100" wrap justifyContent="end">{actions}</Flex> : null}
  </Flex>
)

export const SectionTitle = ({title, subtitle, actions}: {title: string; subtitle?: string; actions?: ReactNode}) => (
  <Flex justifyContent="space-between" alignItems="start" gap="size-200" UNSAFE_style={{marginBottom: '12px'}}>
    <View>
      <Heading level={2} margin={0}>
        {title}
      </Heading>
      {subtitle ? <Text UNSAFE_style={{color: 'var(--spectrum-alias-text-color-secondary)'}}>{subtitle}</Text> : null}
    </View>
    {actions ? <Flex gap="size-100" wrap justifyContent="end">{actions}</Flex> : null}
  </Flex>
)

export const EmptyStateIllustrations = {
  generic: NotFoundIllustration,
  search: NoSearchResultsIllustration,
  upload: UploadIllustration,
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
  <Flex
    direction="column"
    alignItems="center"
    justifyContent="center"
    gap="size-200"
    UNSAFE_style={{
      textAlign: 'center',
      width: '100%',
      minHeight: '100%',
    }}
  >
    <IllustratedMessage>
      {cloneElement(illustration ?? <NotFoundIllustration />, {UNSAFE_className: 'empty-state__illustration'})}
      <Heading level={4}>{title}</Heading>
      <Content>{description}</Content>
    </IllustratedMessage>
    {action ? <View UNSAFE_style={{display: 'flex', justifyContent: 'center'}}>{action}</View> : null}
  </Flex>
)

export const MetricCard = ({label, value}: {label: string; value: string}) => (
  <View
    UNSAFE_style={{
      padding: '20px',
      borderRadius: 'var(--spectrum-alias-border-radius-medium)',
      border: '1px solid var(--spectrum-global-color-gray-200)',
      background: 'var(--spectrum-global-color-gray-50)',
      boxShadow: '0 1px 2px color-mix(in srgb, var(--spectrum-global-color-gray-900) 8%, transparent)',
      minHeight: '8rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '10px',
    }}
  >
    <Text
      UNSAFE_style={{
        color: 'var(--spectrum-alias-text-color-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        fontSize: '0.75rem',
        fontWeight: 700,
      }}
    >
      {label}
    </Text>
    <Heading level={2} margin={0}>
      {value}
    </Heading>
  </View>
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
