import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Tiger Field Brief' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === '/' }}
      className="rounded px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&.active]:bg-slate-900 [&.active]:text-white"
    >
      {children}
    </Link>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
              <Link to="/" className="flex items-center gap-2">
                <span className="text-lg">🐅</span>
                <span className="font-semibold tracking-tight">
                  Tiger Field Brief
                </span>
              </Link>
              <nav className="flex items-center gap-1">
                <NavLink to="/new">New Brief</NavLink>
                <NavLink to="/briefs">Briefs</NavLink>
                <NavLink to="/signals">Signals</NavLink>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        </div>
        <Scripts />
      </body>
    </html>
  )
}
