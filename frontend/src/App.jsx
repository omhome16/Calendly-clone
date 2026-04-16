import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import SchedulingPage from './pages/Scheduling/SchedulingPage'
import MeetingsPage from './pages/Meetings/MeetingsPage'
import AvailabilityPage from './pages/Availability/AvailabilityPage'
import BookingPage from './pages/Booking/BookingPage'
import ConfirmationPage from './pages/Booking/ConfirmationPage'
import LandingPage from './pages/Booking/LandingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin routes wrapped in Layout (with sidebar) */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/scheduling" replace />} />
          <Route path="scheduling" element={<SchedulingPage />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
        </Route>

        {/* Public booking routes — NO sidebar */}
        <Route path="/book" element={<LandingPage />} />
        <Route path="/book/:slug" element={<BookingPage />} />
        <Route path="/book/:slug/confirm" element={<ConfirmationPage />} />

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/scheduling" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
