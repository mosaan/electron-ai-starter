import { useState } from 'react'
import { MessageCircle, Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useSessionManager } from '@renderer/contexts/SessionManager'
import { cn } from '@renderer/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Input } from '@renderer/components/ui/input'

export function SessionList(): React.JSX.Element {
  const {
    sessions,
    currentSessionId,
    createSession,
    switchSession,
    deleteSession,
    updateSession,
    isLoading
  } = useSessionManager()

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const handleCreateSession = async () => {
    await createSession({ title: 'New Chat' })
  }

  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirmId(sessionId)
  }

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId) {
      await deleteSession(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  const handleEditClick = (sessionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(sessionId)
    setEditTitle(currentTitle)
  }

  const handleEditSave = async (sessionId: string) => {
    if (editTitle.trim()) {
      await updateSession(sessionId, { title: editTitle.trim() })
    }
    setEditingId(null)
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditTitle('')
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading sessions...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chat Sessions
          </h2>
        </div>
        <Button onClick={handleCreateSession} className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No chat sessions yet.
            <br />
            Click "New Chat" to start.
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => {
              const isActive = session.id === currentSessionId
              const isEditing = session.id === editingId

              return (
                <div
                  key={session.id}
                  className={cn(
                    'group relative rounded-md p-3 cursor-pointer transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => !isEditing && switchSession(session.id)}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(session.id)
                          if (e.key === 'Escape') handleEditCancel()
                        }}
                        className="h-7 text-sm"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleEditSave(session.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        onClick={handleEditCancel}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{session.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                            {' · '}
                            {new Date(session.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => handleEditClick(session.id, session.title, e)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 hover:text-destructive"
                            onClick={(e) => handleDeleteClick(session.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the chat session and all
              its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
