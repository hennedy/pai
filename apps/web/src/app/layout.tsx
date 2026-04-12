import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Fraunces, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const fontDisplay = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'PAI - Pernambucana Administração Integrada',
  description: 'Sistema de Administração Integrada de Pernambuco',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} font-sans antialiased grain`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
