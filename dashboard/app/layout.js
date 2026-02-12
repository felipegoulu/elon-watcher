export const metadata = {
  title: 'Tweet Watcher',
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
