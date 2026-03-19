/* eslint-disable react/function-component-definition */
import type { Metadata } from 'next';
import './globals.css';
import localFont from 'next/font/local';
import ContextProvider from '@/components/ContextProvider';

export const metadata: Metadata = {
  title: 'InvincibleVoice by Kyutai',
  description: 'Help people with SLA.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const satoshi = localFont({
  src: [
    {
      path: '../assets/fonts/Satoshi-Variable.woff2',
      weight: '300 900',
      style: 'normal',
    },
    {
      path: '../assets/fonts/Satoshi-VariableItalic.woff2',
      weight: '300 900',
      style: 'italic',
    },
  ],
  variable: '--font-satoshi',
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang='en'
      className={satoshi.className}
    >
      <head>
        {/* Needed for debugging JSON styling */}
        <link
          rel='stylesheet'
          href='https://cdn.jsdelivr.net/npm/pretty-print-json@3.0/dist/css/pretty-print-json.dark-mode.css'
        />
      </head>
      <body className='font-satoshi'>
        <ContextProvider>{children}</ContextProvider>
      </body>
    </html>
  );
}
