import { roomID, alias, selfID, unreadMessages } from './stores'
import { goto } from '$app/navigation'
import { page } from '$app/stores'
import { get, writable } from 'svelte/store'
import { WS_PATH } from '../constants'

export const isConnected = writable(false)
export const messages = writable([])

class Room {
  ws: WebSocket
  roomID: string | undefined
  selfID: string | undefined

  get isConnected() {
    return Boolean(this.ws) && this.ws?.readyState === this.ws?.OPEN
  }

  connect(id?: string) {
    if (id && id === this.roomID) {
      console.log('already connected to', roomID)
      return false
    }

    const pageRoomID = get(page).params?.roomID
    console.log('pageRoomID is', pageRoomID)

    console.log('connecting to room', id)
    messages.set([])
    this.disconnect()
    this.roomID = id
    let useAlias = get(alias)
    // const url = [`ws://localhost:8787/v0/rooms/connect`, id].filter(v => v).join('/') + `?echo=true&alias=${get(alias)}`
    let url = [`${WS_PATH}/rooms/connect`, id].filter(v => v).join('/') + `?echo=true`

    if (useAlias) url += '&alias=' + useAlias
    console.log(`connecting to ${url}`)
    const ws = this.ws = new WebSocket(url)
    console.log('this.ws is', this.ws)

    ws.addEventListener('message', (e) => {

      console.log('has focus?', document.hasFocus())
      if (!document.hasFocus()) {
        unreadMessages.update(v => v + 1)
      } else {
        unreadMessages.set(0)
      }

      console.log('received message', e.data)
      const data = JSON.parse(e.data)

      let rID = data?.roomID

      if (rID) {
        console.log('connected to room', rID)

        if (!pageRoomID) {
          goto(`/room/${rID}`, { replaceState: false })
        }
        messages.update(m => [`connected to room ${rID}`])
        this.roomID = rID
        this.selfID = data?.id
        selfID.set(data?.id)
        roomID.set(rID)
      } else {
        if (typeof data === 'object') {
          data.details = {
            date: Date.now(),
            fromSelf: data?.from?.id === this.selfID,
          }
        }
        console.log('processing message', data)
        messages.update(m => [...m, data])
      }
    })

    ws.addEventListener('open', () => isConnected.set(true))
    ws.addEventListener('close', () => this.disconnect(true))
  }

  disconnect(force = false) {
    if (this.isConnected || force) {
      console.log('closing room', this.roomID)
      messages.update(m => [...m, `disconnected from room ${this.roomID}`])

      try {
        this.ws.close()
      } catch (err) {
        console.log('already disconnected.')
      }
      isConnected.set(false)
      this.roomID = undefined
      this.selfID = undefined
      roomID.set(undefined)
      selfID.set(undefined)
      !force && goto('/')
    } else {
      console.log('room already closed')
    }
  }

  send(message: any) {
    if (typeof message !== 'string') {
      message = JSON.stringify(message)
    }

    if (!this.isConnected) {
      console.warn('cannot send a message... not connected')
      return false
    }

    console.log('sending ws message', message)
    this.ws.send(message)
  }
}

export const room = new Room()
