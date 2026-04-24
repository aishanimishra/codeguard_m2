import Sidebar from './Sidebar'

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-bg-base flex">
      <Sidebar />
      <main className="flex-1 ml-56 min-h-screen">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
