import * as React from 'npm:react@18.3.1'
import { Html, Head, Preview, Body, Container, Heading, Text, Section, Button, Hr, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

export interface EventReportRow { title: string; impressions: number; views: number; clicks: number; url: string }
export interface EventReportRestaurant { name: string; events: EventReportRow[] }

const nf = new Intl.NumberFormat('nl-NL')
const row = { padding: '12px 0', borderBottom: '1px solid #eee' }

const EventReport = ({
  ownerName = '',
  monthLabel = 'vorige maand',
  restaurants = [] as EventReportRestaurant[],
  dashboardUrl = 'https://dishloopr.com/owner-dashboard',
  preferencesUrl = 'https://dishloopr.com/owner-dashboard',
}: { ownerName?: string; monthLabel?: string; restaurants?: EventReportRestaurant[]; dashboardUrl?: string; preferencesUrl?: string }) => {
  const totals = restaurants.flatMap(r => r.events).reduce((t, e) => ({ impressions: t.impressions + e.impressions, views: t.views + e.views }), { impressions: 0, views: 0 })
  return (
    <Html lang="nl"><Head /><Preview>{`Je evenementen in ${monthLabel}: ${nf.format(totals.impressions)} keer in beeld, ${nf.format(totals.views)} keer bekeken`}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: '"DM Sans", Arial, sans-serif', color: '#202938' }}>
        <Container style={{ maxWidth: '560px', padding: '32px 24px' }}>
          <Text style={{ color: '#F26522', fontWeight: 'bold', fontSize: '18px', margin: 0 }}>Dishloopr</Text>
          <Heading style={{ fontFamily: '"Bricolage Grotesque", Arial, sans-serif', fontSize: '24px', margin: '16px 0 8px' }}>
            Je evenementen in {monthLabel}
          </Heading>
          <Text>{ownerName ? `Hoi ${ownerName},` : 'Hoi,'}</Text>
          <Text>
            Zo vaak zagen gasten je specials en evenementen op Dishloopr. "In beeld" telt hoe vaak je evenement in een lijst
            of op je restaurantpagina op het scherm stond. "Bekeken" telt hoe vaak iemand de evenementpagina opende.
          </Text>

          <Section style={{ backgroundColor: '#FFF4EC', borderRadius: '12px', padding: '16px 20px', margin: '16px 0' }}>
            <Text style={{ margin: 0, fontSize: '14px' }}>Totaal deze maand</Text>
            <Text style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 'bold', color: '#F26522' }}>
              {nf.format(totals.impressions)} keer in beeld · {nf.format(totals.views)} keer bekeken
            </Text>
          </Section>

          {restaurants.map(r => (
            <Section key={r.name} style={{ margin: '24px 0 0' }}>
              <Text style={{ fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px' }}>{r.name}</Text>
              {r.events.map(e => (
                <Section key={e.url} style={row}>
                  <Link href={e.url} style={{ color: '#202938', fontWeight: 'bold', fontSize: '15px' }}>{e.title}</Link>
                  <Text style={{ margin: '4px 0 0', fontSize: '14px' }}>
                    {`${nf.format(e.impressions)} keer in beeld, ${nf.format(e.views)} keer bekeken`}
                    {e.clicks > 0 ? `, ${nf.format(e.clicks)} kliks naar reserveren of website` : ''}
                  </Text>
                </Section>
              ))}
            </Section>
          ))}

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={dashboardUrl} style={{ backgroundColor: '#F26522', color: '#ffffff', padding: '14px 24px', borderRadius: '8px', fontWeight: 'bold' }}>
              Beheer je evenementen
            </Button>
          </Section>

          <Hr style={{ borderColor: '#eee' }} />
          <Text style={{ color: '#888', fontSize: '12px' }}>
            Je krijgt deze mail omdat je een actief evenement op Dishloopr hebt. Geen maandrapport meer?{' '}
            <Link href={preferencesUrl} style={{ color: '#888' }}>Zet het uit in je dashboard</Link> onder Content, Maandrapport evenementen.
          </Text>
          <Text style={{ color: '#888', fontSize: '12px' }}>Vragen? Mail naar info@dishloopr.com.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EventReport,
  subject: (data: Record<string, any>) => `Je evenementen op Dishloopr in ${data.monthLabel || 'de afgelopen maand'}`,
  displayName: 'Maandrapport evenementen',
  previewData: {
    ownerName: 'Sanne',
    monthLabel: 'november 2026',
    restaurants: [{ name: 'Voorbeeldrestaurant', events: [
      { title: 'Onbeperkt steak', impressions: 1240, views: 86, clicks: 12, url: 'https://dishloopr.com/evenementen/voorbeeld' },
      { title: 'Pubquiz', impressions: 410, views: 31, clicks: 0, url: 'https://dishloopr.com/evenementen/voorbeeld-2' },
    ] }],
  },
} satisfies TemplateEntry
