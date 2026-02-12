import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAdminUsers,
  resetUserPassword,
  downloadBackup,
  restoreDatabase,
} from '../api/client'
import Footer from '../components/Footer'

export default function Admin() {
  const queryClient = useQueryClient()
  const [resetingUserId, setResetingUserId] = useState<number | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: getAdminUsers,
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      resetUserPassword(userId, password),
    onSuccess: (_, { userId }) => {
      setResetingUserId(null)
      setResetPassword('')
      const user = users.find(u => u.id === userId)
      setResetSuccess(`Password reset for ${user?.email || 'user'}`)
      setTimeout(() => setResetSuccess(null), 3000)
    },
  })

  const backupMutation = useMutation({
    mutationFn: downloadBackup,
  })

  const restoreMutation = useMutation({
    mutationFn: restoreDatabase,
    onSuccess: (data) => {
      setRestoreMessage(`Restored successfully. Previous DB backed up as ${data.backup}`)
      queryClient.invalidateQueries()
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
  })

  const handleRestore = () => {
    const file = fileInputRef.current?.files?.[0]
    if (file) {
      restoreMutation.mutate(file)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Admin</h1>
          <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
            Back to Calendar
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Users Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Users</h2>

          {resetSuccess && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md text-sm text-green-800 dark:text-green-300">
              {resetSuccess}
            </div>
          )}

          {usersLoading ? (
            <div className="text-gray-500 dark:text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.email}
                        {user.id === 1 && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
                            admin
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user.event_count} events &middot; Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setResetingUserId(resetingUserId === user.id ? null : user.id)
                        setResetPassword('')
                      }}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      {resetingUserId === user.id ? 'Cancel' : 'Reset Password'}
                    </button>
                  </div>

                  {resetingUserId === user.id && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="password"
                        placeholder="New password (min 8 chars)"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={() => resetPasswordMutation.mutate({ userId: user.id, password: resetPassword })}
                        disabled={resetPassword.length < 8 || resetPasswordMutation.isPending}
                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {resetPasswordMutation.isPending ? 'Resetting...' : 'Confirm'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Database Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Database</h2>

          {restoreMessage && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md text-sm text-green-800 dark:text-green-300">
              {restoreMessage}
            </div>
          )}

          <div className="space-y-4">
            {/* Backup */}
            <div className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
              <p className="font-medium text-gray-900 dark:text-white mb-2">Backup</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Download a copy of the SQLite database file.
              </p>
              <button
                onClick={() => backupMutation.mutate()}
                disabled={backupMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {backupMutation.isPending ? 'Downloading...' : 'Download Backup'}
              </button>
              {backupMutation.isError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {(backupMutation.error as Error).message}
                </p>
              )}
            </div>

            {/* Restore */}
            <div className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
              <p className="font-medium text-gray-900 dark:text-white mb-2">Restore</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Upload a .db file to replace the current database. The current database will be backed up automatically.
              </p>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".db"
                  className="flex-1 text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200 dark:hover:file:bg-gray-600"
                />
                <button
                  onClick={handleRestore}
                  disabled={restoreMutation.isPending}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {restoreMutation.isPending ? 'Restoring...' : 'Restore'}
                </button>
              </div>
              {restoreMutation.isError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {(restoreMutation.error as Error).message}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
