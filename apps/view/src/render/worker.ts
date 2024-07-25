import {
  BoardDatabase,
  createBoardDatabase,
  deleteAllBoards,
  deleteBoard,
  findBoardByUrl,
  getBoard,
  getBoards,
  saveBoard,
} from '../db'

import {RenderWorkerContext, WorkerMessageEvent} from './types'

import {
  boardToStackups,
  filesToStackups,
  stackupToBoard,
  stackupToBoardRender,
  stackupToZipBlob,
  updateBoard,
  updateBoardThumbnail,
  urlToStackups,
} from './models'

import {
  Action,
  ADD_COMMENT,
  allBoardsDeleted,
  boardDeleted,
  boardPackaged,
  boardRendered,
  boardUpdated,
  commentRendered,
  CREATE_BOARD,
  CREATE_BOARD_FROM_URL,
  DELETE_ALL_BOARDS,
  DELETE_BOARD,
  GET_BOARD,
  GET_BOARD_PACKAGE,
  GET_COMMENT,
  GET_COOKIES,
  getComment as getCommentEmitter,
  getCookies,
  UPDATE_BOARD,
  workerErrored,
  workerInitialized,
} from '../state'
import {Comment, CommentWithOutId, CommentWithOutIdAndUserId} from '../types'
import {downloadZipFile} from './files'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx: RenderWorkerContext = self as any
let db: BoardDatabase

createBoardDatabase()
  .then(database => {
    db = database
    return getBoards(db)
  })
  .then(boards => ctx.postMessage(workerInitialized(boards)))

const duration = (start: number): number => Date.now() - start
let cookies: Record<string, string> = {}

type SyncBoardOptions = {
  id: string
  file: File
}
const getUserId = (): string | undefined => {
  ctx.postMessage(getCookies({}))
  return cookies.user_id
}

const COMMENT_API_HOST = 'http://localhost:9000'
// const COMMENT_API_HOST = 'https://productflo.io/'

class RequestError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
  }
}

const syncBoard = async (options: SyncBoardOptions): Promise<void> => {
  const {id, file} = options
  const formData = new FormData()

  formData.append('id', id)

  try {
    const userId = getUserId()

    if (!userId) {
      throw new RequestError('User not authenticated')
    }

    // TODO: get product name
    const productName = 'productflo'

    formData.append('user_id', userId)
    formData.append('folder_path', `/boards/${productName}`)
    formData.append('file', file)

    const url = new URL('/api/files/', COMMENT_API_HOST)

    await fetch(url, {
      method: 'POST',
      credentials: 'include',
    })
  } catch (e) {
    console.error('syncBoard failed', e)
    throw e
  }
}

const addComment = async (
  comment: Comment | CommentWithOutId | CommentWithOutIdAndUserId,
  userId: string
): Promise<Comment> => {
  try {
    console.log('userId', userId)

    if (!userId) {
      throw new RequestError('User not authenticated')
    }

    const url = new URL('/api/comments', COMMENT_API_HOST)
    const headers = new Headers()

    headers.append('Content-Type', 'application/json')

    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        ...comment,
        user_id: userId,
      }),
    })

    if (!response.ok || response.status !== 201) {
      throw new RequestError(`Could not add comment: ${response.status}`)
    }

    return response.json()
  } catch (e) {
    console.error('addComment failed', e)
    if (e instanceof RequestError) {
      throw e
    }
    throw new RequestError("Couldn't add comment to board")
  }
}

const getComment = async (boardId: string): Promise<Array<Comment>> => {
  try {
    const url = new URL(`api/comments/board/${boardId}`, COMMENT_API_HOST)
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (response.ok && response.status === 200) {
      const comments: Array<Comment> = await response.json()

      return comments
    } else {
      throw new RequestError(
        `Could not fetch comments for board ${boardId}: ${response.status}`
      )
    }
  } catch (e) {
    if (e instanceof RequestError) {
      throw e
    }
    throw new RequestError("Couldn't fetch comments for board")
  }
}

ctx.onmessage = function receive(event) {
  const request = event.data
  const startTime = Date.now()
  let response

  switch (request.type) {
    case CREATE_BOARD_FROM_URL: {
      const url = request.payload

      response = Promise.all([
        findBoardByUrl(db, url),
        urlToStackups(url),
      ]).then(async result => {
        const [existingBoard, [selfContained, shared]] = result
        let board = stackupToBoard(selfContained)
        let saveQuery

        board.sourceUrl = url

        if (!existingBoard) {
          const render = stackupToBoardRender(shared, board)

          ctx.postMessage(boardRendered(render, duration(startTime)))
          saveQuery = saveBoard(db, board)
        } else {
          board = updateBoard(board, existingBoard)
          saveQuery = boardToStackups(board).then(stackups => {
            const [selfContained, shared] = stackups
            const render = stackupToBoardRender(shared, board)

            board = updateBoardThumbnail(board, selfContained)
            ctx.postMessage(boardRendered(render, duration(startTime)))

            if (board.sourceUrl) {
              downloadZipFile(url).then(blob => {
                const file = new File([blob], board.id + '.zip', {
                  type: 'application/zip',
                })

                syncBoard({
                  id: board.id,
                  file,
                })
              })
            }
            return saveBoard(db, board)
          })
        }

        return saveQuery.then(() => ctx.postMessage(boardUpdated(board)))
      })

      break
    }

    case CREATE_BOARD: {
      const files = request.payload

      response = filesToStackups(files).then(async stackups => {
        const [selfContained, shared] = stackups
        const board = stackupToBoard(selfContained)
        const render = stackupToBoardRender(shared, board)

        ctx.postMessage(boardRendered(render, duration(startTime)))

        const file = new File(
          [Array.isArray(files) ? files[0] : (files as File)],
          board.id + '.zip',
          {
            type: 'application/zip',
          }
        )

        syncBoard({
          id: board.id,
          file,
        })

        return saveBoard(db, board).then(() =>
          ctx.postMessage(boardUpdated(board))
        )
      })

      break
    }

    case GET_BOARD: {
      const id = request.payload

      response = getBoard(db, id).then(async board =>
        boardToStackups(board).then(stackups => {
          const [, shared] = stackups
          const render = stackupToBoardRender(shared, board)
          ctx.postMessage(boardRendered(render, duration(startTime)))
        })
      )

      break
    }

    case GET_COMMENT: {
      const id = request.payload

      response = getComment(id).then(comments =>
        ctx.postMessage(commentRendered(id, comments))
      )

      break
    }

    case ADD_COMMENT: {
      const {comment, userId} = request.payload || {}
      response = addComment(comment, userId).then(newComment =>
        ctx.postMessage(getCommentEmitter(newComment.board_id))
      )

      break
    }

    case GET_BOARD_PACKAGE: {
      const id = request.payload

      response = getBoard(db, id).then(async board =>
        boardToStackups(board)
          .then(stackups => {
            const [selfContained] = stackups
            return stackupToZipBlob(selfContained)
          })
          .then(blob => ctx.postMessage(boardPackaged(id, board.name, blob)))
      )

      break
    }

    case UPDATE_BOARD: {
      const {id, update} = request.payload

      response = getBoard(db, id).then(async prevBoard => {
        const board = updateBoard(prevBoard, update)

        return boardToStackups(board).then(async stackups => {
          const [selfContained, shared] = stackups
          const render = stackupToBoardRender(shared, board)
          const nextBoard = updateBoardThumbnail(board, selfContained)

          ctx.postMessage(boardRendered(render, duration(startTime)))

          return saveBoard(db, nextBoard).then(() =>
            ctx.postMessage(
              boardUpdated({
                id: nextBoard.id,
                name: nextBoard.name,
                options: nextBoard.options,
                thumbnail: nextBoard.thumbnail,
              })
            )
          )
        })
      })
      break
    }

    case DELETE_BOARD: {
      const id = request.payload

      response = deleteBoard(db, id).then(() =>
        ctx.postMessage(boardDeleted(id))
      )
      break
    }

    case DELETE_ALL_BOARDS: {
      response = deleteAllBoards(db).then(() =>
        ctx.postMessage(allBoardsDeleted())
      )
      break
    }

    case GET_COOKIES: {
      cookies = {
        ...request.payload,
      }
      break
    }
  }

  if (response) {
    response.catch((e: Error) => ctx.postMessage(workerErrored(request, e)))
  }
}

declare module './worker' {
  export default class RenderWorker extends Worker {
    constructor()
    onmessage: (event: WorkerMessageEvent) => void
    postMessage(message: Action): void
  }
}
