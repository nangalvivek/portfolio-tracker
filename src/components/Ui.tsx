import {Content, Flex, Heading, IllustratedMessage, StatusLight, Text, View, Well} from '@adobe/react-spectrum'
import type {ReactNode} from 'react'

export const Panel = ({children}: {children: ReactNode}) => (
  <Well UNSAFE_style={{padding: '16px'}}>{children}</Well>
)

export const SectionTitle = ({title, subtitle, actions}: {title: string; subtitle?: string; actions?: ReactNode}) => (
  <Flex justifyContent="space-between" alignItems="start" gap="size-200" UNSAFE_style={{marginBottom: '16px'}}>
    <View>
      <Heading level={3} margin={0}>
        {title}
      </Heading>
      {subtitle ? <Text UNSAFE_style={{color: 'var(--spectrum-alias-text-color-secondary)'}}>{subtitle}</Text> : null}
    </View>
    {actions ? <Flex gap="size-100" wrap>{actions}</Flex> : null}
  </Flex>
)

export const EmptyState = ({title, description, action, icon}: {title: string; description: string; action?: ReactNode; icon?: ReactNode}) => (
  <Well UNSAFE_style={{borderStyle: 'dashed'}}>
    <IllustratedMessage>
      {icon}
      <Heading>{title}</Heading>
      <Content>{description}</Content>
      {action ? <Content>{action}</Content> : null}
    </IllustratedMessage>
  </Well>
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
