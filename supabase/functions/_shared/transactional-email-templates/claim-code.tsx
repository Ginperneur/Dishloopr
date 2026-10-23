import * as React from 'npm:react@18.3.1'
import { Html, Head, Preview, Body, Container, Heading, Text, Section } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const ClaimCode = ({ restaurantName = 'je restaurant', code = '' }: { restaurantName?: string; code?: string }) => (
  <Html lang="nl"><Head /><Preview>Bevestig je restaurantclaim met deze code</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#202938' }}>
      <Container style={{ maxWidth: '520px', padding: '32px' }}>
        <Heading style={{ color: '#F26522' }}>Je verificatiecode</Heading>
        <Text>Je hebt een claim aangevraagd voor {restaurantName} op Dishloopr. Vul onderstaande code in op de claimpagina om je eigenaarschap te bevestigen.</Text>
        <Section style={{ backgroundColor: '#f3f4f6', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <Text style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 'bold' }}>{code}</Text>
        </Section>
        <Text>De code is 15 minuten geldig. Heb je dit niet aangevraagd? Negeer deze e-mail.</Text>
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