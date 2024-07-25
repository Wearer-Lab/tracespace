import React, {useRef} from 'react'

import {PrimeReactProvider} from 'primereact/api'
import {ContextMenu} from 'primereact/contextmenu'
import {MenuItem} from 'primereact/menuitem'
import ShowComment from '../Comment/ShowComment'
import {useWindowListener} from '../hooks'
import {addComment, useAppState} from '../state'
import {CommentMenuItemData, CommentWithOutId} from '../types'
import {DisplayControllerProps, Point} from './types'
import Cookies from 'js-cookie'

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

// const drawCircle = (x: number, y: number, color: string): void => {
//   const circle = document.createElement('div')
//   circle.style.position = 'absolute'
//   circle.style.width = '10px'
//   circle.style.height = '10px'
//   circle.style.borderRadius = '50%'
//   circle.style.backgroundColor = color
//   circle.style.left = `${x}px`
//   circle.style.top = `${y}px`

//   document.body.appendChild(circle)
// }

const handleAddComment: MenuItem['command'] = ({item: {data}}) => {
  const {point, dispatch, board, mode} = data as CommentMenuItemData

  // draw a circle at x, y to indicate where the comment is
  // drawCircle(point.x, point.y, 'red')

  // add comment
  const message = prompt('Enter your comment')

  if (message && board && mode) {
    const productId = Cookies.get('product_id')

    if (!productId) {
      console.error('product_id not found in cookies')

      throw new Error('product_id not found in cookies')
    }

    const comment: Omit<CommentWithOutId, 'user_id'> = {
      coordinates: [point.x, point.y, 0],
      content: message,
      board_id: board.id,
      mode,
      product_id: productId,
    }

    dispatch(addComment(comment, Cookies.get('user_id') || ''))
  }
}

export default function PanZoom(props: Props): JSX.Element {
  const {mode, board, dispatch} = useAppState()
  const {pan, zoom, containerRef, children} = props
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
      id: 'add-comment',
      label: 'Add Comment',
      icon: 'pi pi-fw pi-plus',
      data: {mode, board, dispatch, point: {x: 0, y: 0}},
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
      <ShowComment />
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
          // drawCircle(e.clientX, e.clientY, 'blue')

          const commentItem = items.find(item => item.id === 'add-comment')

          if (commentItem && commentItem.data) {
            commentItem.data.point = {x: e.clientX, y: e.clientY}
          }

          if (cm.current) {
            cm.current.show(e)
          }
        }}
      >
        <div className="absolute top-50 left-50 tf-center w-100">
          {children}
        </div>
      </div>
    </PrimeReactProvider>
  )
}
