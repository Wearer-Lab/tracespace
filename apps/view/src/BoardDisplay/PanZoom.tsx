import React, {useRef, useState} from 'react'

import {useWindowListener} from '../hooks'
import {DisplayControllerProps, Point} from './types'
import {ContextMenu} from 'primereact/contextmenu'
import {MenuItem} from 'primereact/menuitem'
import {PrimeReactProvider} from 'primereact/api'
import {CommentWithOutId} from '../types'
import {addComment, useAppState} from '../state'
import ShowComment from '../Comment/ShowComment'

type Props = DisplayControllerProps & {
  containerRef: React.RefObject<HTMLDivElement>
  children?: React.ReactNode
}

const WHEEL_THRESHOLD = 20
const WHEEL_THRESHOLD_LINE = 0

const getEventCenter = (event: WheelEvent | React.MouseEvent): Point => ({
  x: event.pageX / window.innerWidth,
  y: event.pageY / window.innerHeight,
})

const handleAddComment: MenuItem['command'] = ({
  originalEvent,
  item: {data},
}) => {
  console.log(data)
  const event = (originalEvent as unknown) as MouseEvent

  const x = event.clientX
  const y = event.clientY

  console.log(x, y)

  // add comment
  const message = prompt('Enter your comment')

  if (message) {
    const comment: CommentWithOutId = {
      addedAt: Date.now() / 1000,
      x,
      y,
      text: message,
      author: 'Anonymous',
      boardId: data.board.id,
      mode: data.mode,
    }

    data.dispatch(addComment(comment))
  }
}

export default function PanZoom(props: Props): JSX.Element {
  const {mode, board, dispatch} = useAppState()
  const {pan, zoom, containerRef, children, scaleRatio} = props
  const panStart = useRef<{x: number; y: number} | null>(null)
  const count = useRef(0)
  const cm = useRef<ContextMenu | null>(null)

  useWindowListener('wheel', function handleWheel(event: WheelEvent): void {
    const {deltaMode, deltaY} = event
    const threshhold =
      deltaMode === event.DOM_DELTA_LINE
        ? WHEEL_THRESHOLD_LINE
        : WHEEL_THRESHOLD

    // increment or decrement count based on scroll direction
    // remember that Math.sign(0) === 0
    count.current += Math.sign(deltaY)

    if (Math.abs(count.current) > threshhold) {
      const direction = Math.sign(-count.current) || 0
      const {x, y} = getEventCenter(event)

      count.current = 0
      zoom(direction, x, y)
    }
  })

  const items: MenuItem[] = [
    {
      label: 'Add Comment',
      icon: 'pi pi-fw pi-plus',
      data: {mode, board, dispatch},
      command: handleAddComment,
    },
  ]

  return (
    <PrimeReactProvider>
      <ContextMenu
        model={items}
        ref={cm}
        breakpoint="767px"
        className="context-menu"
      />
      <div
        ref={containerRef}
        className="absolute absolute--fill"
        onMouseDown={event => (panStart.current = getEventCenter(event))}
        onMouseUp={() => (panStart.current = null)}
        onMouseMove={event => {
          if (panStart.current) {
            const {x: prevX, y: prevY} = panStart.current
            const {x, y} = getEventCenter(event)

            pan(x - prevX, y - prevY)
            panStart.current = {x, y}
          }
        }}
        onContextMenu={e => {
          e.persist()

          if (cm.current) {
            cm.current.show(e)
          }
        }}
      >
        <div className="absolute top-50 left-50 tf-center w-100">
          {children}
          <ShowComment scaleRatio={scaleRatio} />
        </div>
      </div>
    </PrimeReactProvider>
  )
}
