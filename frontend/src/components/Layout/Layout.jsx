import { useState, createContext, useContext, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Menu } from 'lucide-react'

const LayoutContext = createContext({})
export const useLayout = () => useContext(LayoutContext)

export default function Layout() {
  const [collapsed, setCollapsed] = useState(window.innerWidth < 768)
  const [createEventCategory, setCreateEventCategory] = useState(null)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [showSingleUseLinkModal, setShowSingleUseLinkModal] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // Track screen size
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setCollapsed(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleCreateEvent = (category) => {
    if (category === 'single-use-link') {
      setShowSingleUseLinkModal(true)
    } else {
      setCreateEventCategory(category)
      setShowCreatePanel(true)
    }
  }

  const closeCreatePanel = () => {
    setShowCreatePanel(false)
    setCreateEventCategory(null)
  }

  return (
    <LayoutContext.Provider value={{ createEventCategory, showCreatePanel, showSingleUseLinkModal, setShowSingleUseLinkModal, handleCreateEvent, closeCreatePanel }}>
      <div className="flex h-screen overflow-hidden bg-[#f3f4f6]">
        {/* Sidebar */}
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          onCreateEvent={handleCreateEvent}
        />

        {/* Main content area */}
        <div
          className="flex-1 flex flex-col overflow-hidden transition-all duration-300 bg-gray-100"
          style={{ marginLeft: isMobile ? 0 : (collapsed ? 64 : 256) }}
        >
          {/* Global Top Navbar */}
          <header className="h-14 px-4 md:px-6 lg:px-8 flex items-center justify-between bg-white border-b border-gray-200 z-10 shrink-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 md:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1 hover:bg-gray-50 rounded-full py-1 pr-1.5 pl-2 transition-colors duration-150">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-[#006BFF] flex items-center justify-center text-sm font-semibold">
                  D
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 ml-0.5"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  )
}
