import * as React from 'npm:react@18.3.1'
import { Html, Head, Preview, Body, Container, Heading, Text, Section, Button } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

// Mails about paid places (Uitgelicht and Vraag doorsturen): before a quarterly auction, and
// after one (won, outbid, new price). Data comes from promo-auctions.
export type PromoAuctionKind = 'reminder_holder' | 'reminder_bidder' | 'won' | 'outbid' | 'reprice'

interface Props {
  kind?: PromoAuctionKind
  restaurantName?: string
  label?: string
  myCents?: number
  highestBidCents?: number | null
  openBids?: number
  priceCents?: number
  auctionDate?: string
  daysLeft?: number
  link?: string
}

const euro = (c?: number | null) =>
  typeof c === 'number' ? `€${(c / 100).toLocaleString('nl-NL', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}` : ''
const dateNl = (d?: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

const HEADINGS: Record<PromoAuctionKind, string> = {
  reminder_holder: 'Je plek gaat binnenkort in de veiling',
  reminder_bidder: 'Je bod doet mee aan de veiling',
  won: 'Je hebt een plek gewonnen',
  outbid: 'Je bent overboden',
  reprice: 'Nieuwe prijs voor je plek',
}

const PromoAuction = ({ kind = 'reminder_holder', restaurantName = 'je restaurant', label = 'je plek', myCents, highestBidCents,
  openBids = 0, priceCents, auctionDate, daysLeft, link = 'https://dishloopr.nl/owner-dashboard?tab=promotions' }: Props) => (
  <Html lang="nl"><Head /><Preview>{HEADINGS[kind]}: {label}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#202938' }}>
      <Container style={{ maxWidth: '520px', padding: '32px' }}>
        <Heading style={{ color: '#F26522', fontSize: '22px' }}>{HEADINGS[kind]}</Heading>
        <Text style={{ fontWeight: 'bold' }}>{restaurantName}: {label}</Text>

        {kind === 'reminder_holder' && <>
          <Text>
            Over {daysLeft} {daysLeft === 1 ? 'dag' : 'dagen'}, op {dateNl(auctionDate)}, is de veiling voor deze plek. Er {openBids === 1 ? 'ligt 1 bod' : `liggen ${openBids} biedingen`} van
            andere restaurants{highestBidCents ? `, het hoogste is ${euro(highestBidCents)} per maand excl. btw` : ''}. Je betaalt nu {euro(myCents)} per maand excl. btw.
          </Text>
          <Text>
            Wil je je plek zeker houden? Bied het bedrag dat je plek je maximaal waard is. Je betaalt nooit je eigen bod: alle winnaars betalen
            het hoogste bod dat net niet won, minimaal de lijstprijs. Doe je niets, dan doe je mee met de lijstprijs en kun je overboden worden.
          </Text>
        </>}

        {kind === 'reminder_bidder' && <>
          <Text>
            Over {daysLeft} {daysLeft === 1 ? 'dag' : 'dagen'}, op {dateNl(auctionDate)}, doet je bod van {euro(myCents)} per maand excl. btw mee aan de veiling.
            {highestBidCents && highestBidCents > (myCents ?? 0) ? ` Het hoogste bod is nu ${euro(highestBidCents)}.` : ''}
          </Text>
          <Text>Je kunt je bod tot die dag verhogen, verlagen of intrekken. Win je, dan betaal je het hoogste bod dat net niet won, nooit meer dan je eigen bod.</Text>
        </>}

        {kind === 'won' && <>
          <Text>Je krijgt deze plek voor {euro(priceCents)} per maand excl. btw. Rond binnen 7 dagen af, anders gaat de plek naar het volgende bod.</Text>
        </>}

        {kind === 'outbid' && <>
          <Text>
            Andere restaurants boden meer voor deze plek. Je houdt hem tot het eind van de maand waarvoor je al betaald hebt; daarna stopt je
            abonnement vanzelf. Je kunt direct opnieuw bieden om op de wachtlijst te komen.
          </Text>
        </>}

        {kind === 'reprice' && <>
          <Text>Je houdt je plek. Vanaf je volgende factuur betaal je {euro(priceCents)} per maand excl. btw, op basis van de vraag en de veiling van dit kwartaal.</Text>
        </>}

        <Section style={{ padding: '8px 0 16px' }}>
          <Button href={link} style={{ backgroundColor: '#F26522', color: '#ffffff', padding: '14px 20px', borderRadius: '6px' }}>
            {kind === 'won' ? 'Rond je plek af' : kind === 'reprice' ? 'Bekijk je plek' : 'Bekijk of pas je bod aan'}
          </Button>
        </Section>
        <Text style={{ fontSize: '13px', color: '#6b7280' }}>
          Hoe plekken, prijzen en bieden werken lees je op https://dishloopr.nl/voor-restaurants/plekken-en-bieden
        </Text>
        <Text style={{ fontSize: '13px', color: '#6b7280' }}>Vragen? Mail info@dishloopr.com. Dishloopr</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PromoAuction,
  subject: (data: Record<string, any>) => `${HEADINGS[(data.kind as PromoAuctionKind) ?? 'reminder_holder']}: ${data.label ?? 'je plek'}`,
  displayName: 'Plekken: veiling en uitslag',
  previewData: { kind: 'reminder_holder', restaurantName: 'Dishloopr Testkeuken', label: 'Vraag doorsturen voor biefstuk in Den Haag',
    myCents: 1500, highestBidCents: 2500, openBids: 2, auctionDate: '2027-01-01', daysLeft: 14 },
} satisfies TemplateEntry
