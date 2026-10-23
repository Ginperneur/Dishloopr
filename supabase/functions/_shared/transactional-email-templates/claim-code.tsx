import * as React from 'npm:react@18.3.1'
import { Html, Head, Preview, Body, Container, Heading, Text, Section, Button } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const ClaimCode = ({ restaurantName = 'je restaurant', code = '', claimUrl = 'https://dishloopr.com/claim' }: { restaurantName?: string; code?: string; claimUrl?: string }) => (
  <Html lang="nl"><Head /><Preview>Bevestig je restaurantclaim met deze code</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#202938' }}>
      <Container style={{ maxWidth: '520px', padding: '32px' }}>
        <Heading style={{ color: '#F26522' }}>Je verificatiecode</Heading>
        <Text>Je verificatiecode voor {restaurantName} is {code}. Vul hem in op de claimpagina of klik op de knop hieronder. De code is 30 minuten geldig.</Text>
        <Section style={{ backgroundColor: '#f3f4f6', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <Text style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 'bold' }}>{code}</Text>
        </Section>
        <Button href={claimUrl} style={{ backgroundColor: '#F26522', color: '#ffffff', padding: '14px 20px', borderRadius: '6px' }}>Vul je code in</Button>
        <Text>Heb je dit niet aangevraagd? Negeer deze e-mail.</Text>
        <Text>Vragen? Neem contact op via info@dishloopr.com.</Text><Text>Dishloopr</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ClaimCode,
  subject: (data: Record<string, unknown>) => `Verificatiecode voor ${data.restaurantName || 'je restaurant'} op Dishloopr`,
  displayName: 'Restaurantclaim: verificatiecode',
  previewData: { restaurantName: 'Voorbeeldrestaurant', code: '123456' },
} satisfies TemplateEntry