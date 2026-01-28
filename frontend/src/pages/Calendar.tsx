import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, addDays, startOfDay, isSameDay } from 'date-fns'
import { getEvents, getAgendaItems, rolloverAgenda, logout } from '../api/client'
import CalendarView from '../components/CalendarView'

type ViewDays = 1 | 3 | 7 | 14

export default function Calendar() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()))
  const [viewDays, setViewDays] = useState<ViewDays>(7)
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const rolledOver = useRef(false)

  // Rollover incomplete past agenda items to today on page load
  useEffect(() => {
    if (rolledOver.current) return
    rolledOver.current = true
    const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
    rolloverAgenda(today).then((result) => {
      if (result.items_moved > 0) {
        queryClient.invalidateQueries({ queryKey: ['agenda'] })
      }
    }).catch(() => {
      // Silently ignore rollover failures
    })
  }, [queryClient])

  const endDate = useMemo(() => addDays(startDate, viewDays), [startDate, viewDays])

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events', startDate.toISOString(), endDate.toISOString()],
    queryFn: () => getEvents(startDate.toISOString(), endDate.toISOString()),
  })

  const { data: agendaItems = [], isLoading: agendaLoading } = useQuery({
    queryKey: ['agenda', startDate.toISOString(), endDate.toISOString()],
    queryFn: () => getAgendaItems(
      format(startDate, 'yyyy-MM-dd'),
      format(addDays(endDate, -1), 'yyyy-MM-dd')
    ),
  })

  const handleLogout = async () => {
    await logout()
    queryClient.clear()
    navigate('/login')
  }

  const goToToday = () => setStartDate(startOfDay(new Date()))
  const goPrev = () => setStartDate(prev => addDays(prev, -1))
  const goNext = () => setStartDate(prev => addDays(prev, 1))

  // Group events and agenda by date
  const dayData = useMemo(() => {
    const days: Array<{
      date: Date
      events: typeof events
      agenda: typeof agendaItems
    }> = []

    for (let i = 0; i < viewDays; i++) {
      const date = addDays(startDate, i)
      const dateStr = format(date, 'yyyy-MM-dd')

      const dayEvents = events.filter(e => {
        const eventDate = new Date(e.start_time)
        return isSameDay(eventDate, date)
      }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

      const dayAgenda = agendaItems.filter(a => a.date === dateStr)

      days.push({ date, events: dayEvents, agenda: dayAgenda })
    }

    return days
  }, [startDate, viewDays, events, agendaItems])

  const isLoading = eventsLoading || agendaLoading

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">DateStack</h1>
            <div className="flex items-center gap-3">
              <Link
                to="/settings"
                className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100"
                aria-label="Previous day"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md"
              >
                Today
              </button>
              <button
                onClick={goNext}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100"
                aria-label="Next day"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* View selector */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-md p-1">
              {([1, 3, 7, 14] as ViewDays[]).map(days => (
                <button
                  key={days}
                  onClick={() => setViewDays(days)}
                  className={`px-3 py-1 text-sm rounded ${
                    viewDays === days
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          {/* Date range display */}
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {format(startDate, 'MMM d')} - {format(addDays(endDate, -1), 'MMM d, yyyy')}
            <span className="ml-2 text-gray-400 dark:text-gray-500">({timezone.replace('America/', '').replace('_', ' ')})</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {dayData.map(({ date, events, agenda }) => (
              <CalendarView
                key={date.toISOString()}
                date={date}
                events={events}
                agendaItems={agenda}
                timezone={timezone}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
