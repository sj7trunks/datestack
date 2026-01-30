import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getApiKeys,
  createApiKey,
  deleteApiKey,
  getSources,
  getAvailabilitySettings,
  updateAvailabilitySettings,
  regenerateShareToken,
  getCalendarColors,
  updateCalendarColor,
} from '../api/client'
import { useTheme } from '../contexts/ThemeContext'
import Footer from '../components/Footer'

type ViewDays = 1 | 3 | 7 | 14

export default function Settings() {
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()
  const [defaultViewDays, setDefaultViewDays] = useState<ViewDays>(() => {
    const stored = localStorage.getItem('defaultViewDays')
    if (stored && ['1', '3', '7', '14'].includes(stored)) {
      return parseInt(stored, 10) as ViewDays
    }
    return 7
  })
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)

  const { data: apiKeys = [], isLoading: keysLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: getApiKeys,
  })

  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: getSources,
  })

  const { data: calendarColors = [], isLoading: colorsLoading } = useQuery({
    queryKey: ['calendarColors'],
    queryFn: getCalendarColors,
  })

  const updateCalendarColorMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) => updateCalendarColor(name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarColors'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })

  const { data: availability, isLoading: availabilityLoading } = useQuery({
    queryKey: ['availability'],
    queryFn: getAvailabilitySettings,
  })

  const updateAvailabilityMutation = useMutation({
    mutationFn: updateAvailabilitySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  const regenerateTokenMutation = useMutation({
    mutationFn: regenerateShareToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => createApiKey(name),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
      setNewKeyName('')
      setCreatedKey(data.key || null)
    },
  })

  const deleteKeyMutation = useMutation({
    mutationFn: (id: number) => deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault()
    if (newKeyName.trim()) {
      createKeyMutation.mutate(newKeyName.trim())
    }
  }

  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#6366F1', // indigo
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h1>
          <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
            Back to Calendar
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Theme Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Appearance</h2>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 text-sm rounded-md border ${
                  theme === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {/* Calendar View Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Calendar View</h2>
          <div className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
            <p className="font-medium text-gray-900 dark:text-white mb-3">Default View</p>
            <div className="flex gap-2">
              {([1, 3, 7, 14] as ViewDays[]).map((days) => (
                <button
                  key={days}
                  onClick={() => {
                    setDefaultViewDays(days)
                    localStorage.setItem('defaultViewDays', days.toString())
                  }}
                  className={`px-4 py-2 text-sm rounded-md border ${
                    defaultViewDays === days
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {days} {days === 1 ? 'day' : 'days'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* API Keys Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">API Keys</h2>

          {/* Created key display */}
          {createdKey && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                API key created! Copy it now - it won't be shown again.
              </p>
              <code className="block p-2 bg-white dark:bg-gray-800 rounded border dark:border-gray-700 text-sm font-mono break-all text-gray-900 dark:text-gray-100">
                {createdKey}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdKey)
                }}
                className="mt-2 text-sm text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
              >
                Copy to clipboard
              </button>
            </div>
          )}

          {/* Create new key form */}
          <form onSubmit={handleCreateKey} className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Key name (e.g., Work Mac)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={createKeyMutation.isPending || !newKeyName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Create Key
            </button>
          </form>

          {/* Key list */}
          {keysLoading ? (
            <div className="text-gray-500 dark:text-gray-400">Loading...</div>
          ) : apiKeys.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No API keys yet. Create one to sync calendars from your Mac.</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{key.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {key.key_preview} &middot; Created {new Date(key.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteKeyMutation.mutate(key.id)}
                    disabled={deleteKeyMutation.isPending}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Calendar Sources Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Calendar Sources</h2>

          {sourcesLoading ? (
            <div className="text-gray-500 dark:text-gray-400">Loading...</div>
          ) : sources.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No calendar sources yet. Sync from your Mac to see them here.
            </p>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{source.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {source.last_sync
                        ? `Last sync: ${new Date(source.last_sync + 'Z').toLocaleString()}`
                        : 'Never synced'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Calendar Colors Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Calendar Colors</h2>

          {colorsLoading ? (
            <div className="text-gray-500 dark:text-gray-400">Loading...</div>
          ) : calendarColors.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No calendars yet. Colors will appear after syncing events.
            </p>
          ) : (
            <div className="space-y-3">
              {calendarColors.map((cc) => (
                <div
                  key={cc.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: cc.color }}
                    />
                    <span className="font-medium text-gray-900 dark:text-white">{cc.calendar_name}</span>
                  </div>
                  <div className="flex gap-1">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateCalendarColorMutation.mutate({ name: cc.calendar_name, color })}
                        className={`w-6 h-6 rounded-full border-2 ${
                          cc.color === color ? 'border-gray-400 dark:border-gray-300' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        title={`Set color to ${color}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Availability Sharing Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Availability Sharing</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Share a link that shows your busy/free time without revealing event details.
          </p>

          {availabilityLoading ? (
            <div className="text-gray-500 dark:text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Enable toggle */}
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Enable Sharing</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Allow others to view your availability
                  </p>
                </div>
                <button
                  onClick={() => updateAvailabilityMutation.mutate({ enabled: !availability?.enabled })}
                  disabled={updateAvailabilityMutation.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    availability?.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      availability?.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Time range */}
              <div className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                <p className="font-medium text-gray-900 dark:text-white mb-3">Working Hours</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">From</label>
                    <select
                      value={availability?.start_hour ?? 8}
                      onChange={(e) => updateAvailabilityMutation.mutate({ start_hour: parseInt(e.target.value) })}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">To</label>
                    <select
                      value={availability?.end_hour ?? 17}
                      onChange={(e) => updateAvailabilityMutation.mutate({ end_hour: parseInt(e.target.value) })}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Share link */}
              {availability?.share_token && (
                <div className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-white mb-2">Share Link</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/availability/${availability.share_token}`}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/availability/${availability.share_token}`)
                        setCopiedToken(true)
                        setTimeout(() => setCopiedToken(false), 2000)
                      }}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {copiedToken ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <button
                    onClick={() => regenerateTokenMutation.mutate()}
                    disabled={regenerateTokenMutation.isPending}
                    className="mt-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Regenerate link
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
