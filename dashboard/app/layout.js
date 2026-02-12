export const metadata = {
  title: 'PinchMe',
  description: 'Real-time X monitoring',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
