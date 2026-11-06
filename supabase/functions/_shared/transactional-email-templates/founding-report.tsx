import * as React from 'npm:react@18.3.1'
import { Html, Head, Preview, Body, Container, Heading, Text, Section, Button, Hr, Link } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

export interface FoundingReportRow { restaurant: string; page: string; impressions: number; clicks: number; url: string }

const nf = new Intl.NumberFormat('nl-NL')
const row = { padding: '12px 0', borderBottom: '1px solid #eee' }

const FoundingReport = ({
  ownerName = '',
  monthLabel = 'vorige maand',
  rows = [] as FoundingReportRow[],
  dashboardUrl = 'https://dishloopr.com/owner-dashboard',
  preferencesUrl = 'https://dishloopr.com/owner-dashboard',
}: { ownerName?: string; monthLabel?: string; rows?: FoundingReportRow[]; dashboardUrl?: string; preferencesUrl?: string }) => {
  const totals = rows.reduce((t, r) => ({ impressions: t.impressions + r.impressions, clicks: t.clicks + r.clicks }), { impressions: 0, clicks: 0 })
  return (
    <Html lang="nl"><Head /><Preview>{`Je plek in Uitgelicht in ${monthLabel}: ${nf.format(totals.impressions)} keer in beeld, ${nf.format(totals.clicks)} keer aangeklikt`}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: '"DM Sans", Arial, sans-serif', color: '#202938' }}>
        <Container style={{ maxWidth: '560px', padding: '32px 24px' }}>
          <Text style={{ color: '#F26522', fontWeight: 'bold', fontSize: '18px', margin: 0 }}>Dishloopr</Text>
          <Heading style={{ fontFamily: '"Bricolage Grotesque", Arial, sans-serif', fontSize: '24px', margin: '16px 0 8px' }}>
            Je plek als Founding Partner in {monthLabel}
          </Heading>
          <Text>{ownerName ? `Hoi ${ownerName},` : 'Hoi,'}</Text>
          <Text>
            Zo vaak stond je restaurant bovenaan in het blok "Uitgelicht" op je gerechtpagina. "In beeld" telt hoe vaak
            je kaart voor minstens de helft op het scherm stond. "Aangeklikt" telt hoe vaak iemand vanuit dat blok je pagina opende.
          </Text>

          <Section style={{ backgroundColor: '#FFF4EC', borderRadius: '12px', padding: '16px 20px', margin: '16px 0' }}>
            <Text style={{ margin: 0, fontSize: '14px' }}>Totaal deze maand</Text>
            <Text style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 'bold', color: '#F26522' }}>
              {nf.format(totals.impressions)} keer in beeld · {nf.format(totals.clicks)} keer aangeklikt
            </Text>
          </Section>

          {rows.map(r => (
            <Section key={r.url} style={row}>
              <Link href={r.url} style={{ color: '#202938', fontWeight: 'bold', fontSize: '15px' }}>{r.restaurant} op {r.page}</Link>
              <Text style={{ margin: '4px 0 0', fontSize: '14px' }}>
                {`${nf.format(r.impressions)} keer in beeld, ${nf.format(r.clicks)} keer aangeklikt`}
              </Text>
            </Section>
          ))}

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href={dashboardUrl} style={{ backgroundColor: '#F26522', color: '#ffffff', padding: '14px 24px', borderRadius: '8px', fontWeight: 'bold' }}>
              Bekijk je dashboard
            </Button>
          </Section>

          <Hr style={{ borderColor: '#eee' }} />
          <Text style={{ color: '#888', fontSize: '12px' }}>
            Je krijgt deze mail omdat je Founding Partner bent op Dishloopr. Geen maandrapport meer?{' '}
            <Link href={preferencesUrl} style={{ color: '#888' }}>Zet het uit in je dashboard</Link>.
          </Text>
          <Text style={{ color: '#888', fontSize: '12px' }}>Vragen? Mail naar info@dishloopr.com.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: FoundingReport,
  subject: (data: Record<string, any>) => `Je plek in Uitgelicht op Dishloopr in ${data.monthLabel || 'de afgelopen maand'}`,
  displayName: 'Maandrapport Founding Partner',
  previewData: {
    ownerName: 'Sanne',
    monthLabel: 'december 2026',
    rows: [{ restaurant: 'Voorbeeldrestaurant', page: 'carbonara-utrecht', impressions: 2140, clicks: 163, url: 'https://dishloopr.com/eten/carbonara-utrecht' }],
  },
} satisfies TemplateEntry
