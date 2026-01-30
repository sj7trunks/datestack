import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createAgendaItem, updateAgendaItem, deleteAgendaItem, type AgendaItem } from '../api/client'

interface AgendaListProps {
  items: AgendaItem[]
  date: string
}

export default function AgendaList({ items, date }: AgendaListProps) {
  const queryClient = useQueryClient()
  const [newItemText, setNewItemText] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  // Sort: uncompleted first (by created_at), then completed (by created_at)
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      // Uncompleted items come first
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1
      }
      // Within same completion status, sort by created_at (oldest first)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [items])

  const createMutation = useMutation({
    mutationFn: (text: string) => createAgendaItem(text, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      setNewItemText('')
      setIsAdding(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, text, completed }: { id: number; text?: string; completed?: boolean }) =>
      updateAgendaItem(id, { text, completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      setEditingId(null)
      setEditText('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAgendaItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newItemText.trim()) {
      createMutation.mutate(newItemText.trim())
    }
  }

  const toggleComplete = (item: AgendaItem) => {
    updateMutation.mutate({ id: item.id, completed: !item.completed })
  }

  const startEditing = (item: AgendaItem) => {
    setEditingId(item.id)
    setEditText(item.text)
  }

  const saveEdit = (id: number) => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== items.find(i => i.id === id)?.text) {
      updateMutation.mutate({ id, text: trimmed })
    } else {
      cancelEdit()
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(id)
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tasks</span>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            + Add
          </button>
        )}
      </div>

      {/* Item list */}
      <div className="space-y-1">
        {sortedItems.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-2 py-1"
          >
            <button
              onClick={() => toggleComplete(item)}
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                item.completed
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              disabled={updateMutation.isPending}
            >
              {!!item.completed && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            {editingId === item.id ? (
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => saveEdit(item.id)}
                onKeyDown={(e) => handleEditKeyDown(e, item.id)}
                autoFocus
                className="flex-1 px-1 py-0 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            ) : (
              <span
                onClick={() => !item.completed && startEditing(item)}
                className={`flex-1 text-sm ${
                  item.completed
                    ? 'text-gray-400 dark:text-gray-500 line-through'
                    : 'text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                {item.text}
              </span>
            )}
            <button
              onClick={() => deleteMutation.mutate(item.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity"
              disabled={deleteMutation.isPending}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add new item form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="New task..."
            autoFocus
            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !newItemText.trim()}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false)
              setNewItemText('')
            }}
            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  )
}
