// The connection to a room: one WebSocket, JSON messages, and a retry when the
// connection drops. The server pushes every change; nothing here polls.

import type { ClientMessage, ServerMessage } from './messages.ts'

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface RoomConnection {
  send(message: ClientMessage): void
  close(): void
}

interface Handlers {
  /** The first message to send each time the connection opens. */
  join: () => ClientMessage
  onmessage: (message: ServerMessage) => void
  onstatus: (status: ConnectionStatus) => void
}

/** Close codes the server uses to say "do not come back" (server/app/ws.py). */
const FINAL_CLOSE_CODES = [4404, 4409, 4410]
const RETRY_MS = [1000, 2000, 4000, 8000]

export async function createRoom(): Promise<{ code: string; seed: number }> {
  const response = await fetch('/api/rooms', { method: 'POST' })
  if (!response.ok) throw new Error(response.status === 503 ? 'server_full' : 'offline')
  return response.json()
}

export async function roomExists(code: string): Promise<boolean> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}`)
  if (response.status === 404) return false
  if (!response.ok) throw new Error('offline')
  return true
}

export function connectRoom(code: string, handlers: Handlers): RoomConnection {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${encodeURIComponent(code)}`
  let socket: WebSocket | null = null
  let closed = false
  let attempt = 0
  let retry: ReturnType<typeof setTimeout> | undefined

  const open = () => {
    handlers.onstatus(attempt === 0 ? 'connecting' : 'reconnecting')
    socket = new WebSocket(url)
    socket.onopen = () => {
      attempt = 0
      handlers.onstatus('open')
      socket?.send(JSON.stringify(handlers.join()))
    }
    socket.onmessage = (event) => {
      try {
        handlers.onmessage(JSON.parse(event.data as string) as ServerMessage)
      } catch {
        // Not JSON: ignore it.
      }
    }
    socket.onclose = (event) => {
      if (closed) return
      if (FINAL_CLOSE_CODES.includes(event.code)) {
        closed = true
        handlers.onstatus('closed')
        return
      }
      handlers.onstatus('reconnecting')
      retry = setTimeout(open, RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)])
      attempt++
    }
  }
  open()

  return {
    send(message) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
    },
    close() {
      closed = true
      clearTimeout(retry)
      socket?.close()
      handlers.onstatus('closed')
    },
  }
}
