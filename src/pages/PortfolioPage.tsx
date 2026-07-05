import {useEffect, useMemo, useState} from 'react'
import {Button, Column, Content, Heading, IllustratedMessage, SearchField, StatusLight, TableBody, TableHeader, TableView, Cell, Row, Text} from '@react-spectrum/s2'
import {ButtonGroup} from '@react-spectrum/s2'
import {style, space} from '@react-spectrum/s2/style' with {type: 'macro'}
import DropToUploadIllustration from '@react-spectrum/s2/illustrations/gradient/generic1/DropToUpload'
import {useNavigate} from 'react-router-dom'
import {usePortfolioData} from '../hooks/usePortfolioData'
import {formatMoney, formatQty} from '../lib/format'
import {Panel, PageHeader, SectionTitle, EmptyState, EmptyStateIllustrations, pageStackStyle, pageEmptyStackStyle, pageSectionGridStyle, pageEmptyRegionStyle, secondaryTextStyle, toStyleString} from '../components/Ui'

type RegionFilter = 'ALL' | 'IN' | 'US'

const portfolioToolbarStyle: string = style({display: 'flex', gap: space(16), flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between'})
const filterGroupStyle: string = style({display: 'flex', gap: space(8), flexWrap: 'wrap'})
const pageTableStackStyle: string = style({display: 'grid', gap: space(20)})
const selectedLotsStyle: string = style({display: 'grid', gap: space(12)})

export const PortfolioPage = () => {
  const navigate = useNavigate()
  const {holdings} = usePortfolioData()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<RegionFilter>('ALL')
  const [selectedHoldingId, setSelectedHoldingId] = useState('')

  const filteredHoldings = useMemo(() => {
    const query = search.trim().toLowerCase()
    return holdings.filter((holding) => {
      const security = holding.security
      const matchesFilter = filter === 'ALL' || holding.region === filter
      const matchesSearch = !query || security?.symbol.toLowerCase().includes(query) || security?.isin?.toLowerCase().includes(query)
      return matchesFilter && matchesSearch
    })
  }, [filter, holdings, search])

  useEffect(() => {
    if (!selectedHoldingId && filteredHoldings[0]) setSelectedHoldingId(filteredHoldings[0].securityId + '|' + filteredHoldings[0].accountId)
    if (selectedHoldingId && !filteredHoldings.some((holding) => `${holding.securityId}|${holding.accountId}` === selectedHoldingId)) {
      setSelectedHoldingId(filteredHoldings[0] ? `${filteredHoldings[0].securityId}|${filteredHoldings[0].accountId}` : '')
    }
  }, [filteredHoldings, selectedHoldingId])

  const selectedHolding = filteredHoldings.find((holding) => `${holding.securityId}|${holding.accountId}` === selectedHoldingId)

  return (
    <div className={holdings.length === 0 ? pageEmptyStackStyle : pageStackStyle}>
      <PageHeader title="Portfolio" />

      {holdings.length === 0 ? (
        <div className={pageEmptyRegionStyle}>
          <IllustratedMessage size="L">
            <DropToUploadIllustration />
            <Heading>No holdings yet</Heading>
            <Content>Upload a tradebook to populate holdings and open lots.</Content>
            <ButtonGroup>
              <Button variant="accent" onPress={() => navigate('/uploads')}>Upload tradebook</Button>
            </ButtonGroup>
          </IllustratedMessage>
        </div>
      ) : (
        <Panel>
          <div className={pageSectionGridStyle}>
            <div className={portfolioToolbarStyle}>
              <SearchField label="Search holdings" description="Search by symbol or ISIN" value={search} onChange={setSearch} />
              <div className={filterGroupStyle}>
                {(['ALL', 'IN', 'US'] as const).map((item) => (
                  <Button key={item} variant={filter === item ? 'accent' : 'secondary'} onPress={() => setFilter(item)}>{item === 'ALL' ? 'All' : item === 'IN' ? 'India' : 'Foreign'}</Button>
                ))}
              </div>
            </div>

            {filteredHoldings.length === 0 ? (
              <EmptyState title="No matching holdings" description="Try a different symbol, ISIN, or region filter." illustration={<EmptyStateIllustrations.search />} />
            ) : (
              <div className={pageTableStackStyle}>
                <TableView aria-label="Portfolio holdings" density="compact">
                  <TableHeader>
                    <Column isRowHeader>Security</Column>
                    <Column>Account</Column>
                    <Column align="end">Quantity</Column>
                    <Column align="end">Average cost INR</Column>
                    <Column align="end">Current price INR</Column>
                    <Column align="end">Unrealized P&amp;L</Column>
                    <Column>Action</Column>
                  </TableHeader>
                  <TableBody items={filteredHoldings}>
                    {(holding) => (
                      <Row key={`${holding.securityId}|${holding.accountId}`}>
                        <Cell>
                          <div>
                            <Heading level={4}>{holding.security?.symbol ?? holding.securityId}</Heading>
                            <Text styles={toStyleString(secondaryTextStyle)}>{holding.security?.isin ?? '—'} · {holding.region}</Text>
                          </div>
                        </Cell>
                        <Cell>{holding.account?.name ?? holding.accountId}</Cell>
                        <Cell>{formatQty(holding.quantity)}</Cell>
                        <Cell>{formatMoney(holding.averageCostInr)}</Cell>
                        <Cell>{holding.unpriced ? '—' : formatMoney(holding.currentPriceInr)}</Cell>
                        <Cell>
                          {holding.unrealizedPnlInr === undefined ? '—' : (
                            <StatusLight variant={holding.unrealizedPnlInr >= 0 ? 'positive' : 'negative'}>{formatMoney(holding.unrealizedPnlInr)}</StatusLight>
                          )}
                        </Cell>
                        <Cell>
                          <Button variant="secondary" onPress={() => setSelectedHoldingId(`${holding.securityId}|${holding.accountId}`)}>Open lots</Button>
                        </Cell>
                      </Row>
                    )}
                  </TableBody>
                </TableView>

                {selectedHolding ? (
                  <div className={selectedLotsStyle}>
                    <SectionTitle title={`FIFO open lots for ${selectedHolding.security?.symbol ?? selectedHolding.securityId}`} subtitle="Details for the selected holding." />
                    {selectedHolding.openLots.length === 0 ? (
                      <EmptyState title="No open lots" description="All lots for this holding have been sold." illustration={<EmptyStateIllustrations.generic />} />
                    ) : (
                      <TableView aria-label="Open lots" density="compact">
                        <TableHeader>
                          <Column isRowHeader>Buy date</Column>
                          <Column align="end">Remaining qty</Column>
                          <Column align="end">Cost per unit INR</Column>
                          <Column align="end">Cost basis INR</Column>
                        </TableHeader>
                        <TableBody items={selectedHolding.openLots}>
                          {(lot) => (
                            <Row key={`${selectedHolding.securityId}-${selectedHolding.accountId}-${lot.date}-${lot.remaining}`}>
                              <Cell>{lot.date}</Cell>
                              <Cell>{formatQty(lot.remaining)}</Cell>
                              <Cell>{formatMoney(lot.costPerUnitInr)}</Cell>
                              <Cell>{formatMoney(lot.remaining * lot.costPerUnitInr)}</Cell>
                            </Row>
                          )}
                        </TableBody>
                      </TableView>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  )
}
