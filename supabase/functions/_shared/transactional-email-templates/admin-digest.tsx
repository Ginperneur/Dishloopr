import * as React from 'npm:react@18.3.1'
import { Html, Head, Preview, Body, Container, Heading, Text, Section, Button, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

// Daily mail to admins: what waits for a person, and what the automation did in the last 24 hours.
export interface DigestQueue { label: string; section: string; open_count: number; new_24h: number; oldest_days: number }
interface Props {
  date?: string
  queues?: DigestQueue[]
  automated?: { label: string; count: number }[]
}

const BASE = 'https://dishloopr.nl/admin?section='

const AdminDigest = ({ date = '', queues = [], automated = [] }: Props) => {
  const open = queues.reduce((s, q) => s + q.open_count, 0)
  const fresh = queues.reduce((s, q) => s + q.new_24h, 0)
  return (
    <Html lang="nl"><Head /><Preview>{open === 0 ? 'Niets dat op je wacht' : `${open} open, waarvan ${fresh} nieuw`}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#202938' }}>
        <Container style={{ maxWidth: '560px', padding: '32px' }}>
          <Heading style={{ color: '#F26522', fontSize: '22px' }}>Dishloopr vandaag{date ? `, ${date}` : ''}</Heading>
          <Text>{open === 0 ? 'Er wacht niets op je. Alles is afgehandeld.' : `Er wachten ${open} dingen op je, waarvan ${fresh} sinds gisteren binnen.`}</Text>

          {queues.filter(q => q.open_count > 0).map(q => (
            <Section key={q.section + q.label} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
              <Text style={{ margin: 0, fontWeight: 'bold' }}>
                <a href={BASE + q.section} style={{ color: '#202938' }}>{q.label}: {q.open_count}</a>
              </Text>
              <Text style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                {q.new_24h > 0 ? `${q.new_24h} nieuw` : 'niets nieuw'}{q.oldest_days >= 2 ? `, oudste wacht al ${q.oldest_days} dagen` : ''}
              </Text>
            </Section>
          ))}

          {automated.some(a => a.count > 0) && <>
            <Hr />
            <Text style={{ fontWeight: 'bold' }}>Automatisch afgehandeld (24 uur)</Text>
            {automated.filter(a => a.count > 0).map(a => (
              <Text key={a.label} style={{ margin: '2px 0', fontSize: '14px' }}>{a.label}: {a.count}</Text>
            ))}
          </>}

          <Section style={{ padding: '16px 0' }}>
            <Button href="https://dishloopr.nl/admin?section=today" style={{ backgroundColor: '#F26522', color: '#ffffff', padding: '14px 20px', borderRadius: '6px' }}>
              Open het adminpaneel
            </Button>
          </Section>
          <Text style={{ fontSize: '13px', color: '#6b7280' }}>Deze mail komt elke ochtend om 7:00 naar alle admins. Dishloopr</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AdminDigest,
  subject: (d: Record<string, any>) => {
    const open = (d.queues ?? []).reduce((s: number, q: DigestQueue) => s + q.open_count, 0)
    return open === 0 ? 'Dishloopr: niets dat op je wacht' : `Dishloopr: ${open} dingen wachten op je`
  },
  displayName: 'Admin: dagelijks overzicht',
  previewData: { date: '15 november', queues: [
    { label: 'Claims die op goedkeuring wachten', section: 'claims', open_count: 2, new_24h: 1, oldest_days: 3 },
    { label: 'Contactberichten', section: 'contact', open_count: 1, new_24h: 1, oldest_days: 0 },
  ], automated: [{ label: 'Beschrijvingen doorgevoerd', count: 3 }] },
} satisfies TemplateEntry
