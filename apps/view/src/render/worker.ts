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
  getComment as getCommentEmitter,
  CREATE_BOARD,
  CREATE_BOARD_FROM_URL,
  DELETE_ALL_BOARDS,
  DELETE_BOARD,
  GET_BOARD,
  GET_BOARD_PACKAGE,
  GET_COMMENT,
  UPDATE_BOARD,
  workerErrored,
  workerInitialized,
} from '../state'
import {Comment, CommentWithOutId} from '../types'

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

type SyncBoardOptions = {
  id: string
  url: string | null
  file: File | null
}

const syncBoard = async (options: SyncBoardOptions): Promise<void> => {
  const {id, url, file} = options
  const formData = new FormData()

  formData.append('id', id)

  if (url) {
    formData.append('url', url)
  } else if (file) {
    formData.append('file', file)
  }

  try {
    await fetch('/api/sync', {
      method: 'POST',
      body: formData,
    })
  } catch (e) {
    console.error('syncBoard failed', e)
    throw e
  }
}

const FAKE_COMMENTS_DB: Array<Comment> = [
  {
    id: '1',
    mode: 'top',
    text: 'This is a comment',
    x: 0.5,
    y: 0.5,
    boardId: '',
    addedAt: Date.now(),
    author: 'Michael Chan',
  },
  {
    id: '2',
    mode: 'top',
    text: 'This is a comment',
    x: 0.5,
    y: 0.5,
    boardId: '',
    addedAt: Date.now(),
    author: 'Michael Chan',
  },
]

const addComment = async (
  comment: Comment | CommentWithOutId
): Promise<Comment> => {
  try {
    // const response = await fetch('/api/comment', {
    //   method: 'POST',
    //   headers: {'Content-Type': 'application/json'},
    //   body: JSON.stringify(comment),
    // })

    // if (!response.ok) {
    //   throw new Error(`Could not add comment: ${response.status}`)
    // }

    // return response.json()
    const newComment: Comment = {
      ...comment,
      id: Date.now().toString(),
    }

    FAKE_COMMENTS_DB.push(newComment)

    return newComment
  } catch (e) {
    console.error('addComment failed', e)
    throw new Error("Couldn't add comment to board")
  }
}

const getComment = async (boardId: string): Promise<Array<Comment>> => {
  try {
    // TODO: Uncomment when API is ready
    // const response = await fetch(`/api/board/${boardId}/comments/`)

    // if (response.ok) {
    //   const comments: Array<Comment> = await response.json()

    //   return comments
    // } else {
    //   throw new Error(
    //     `Could not fetch comments for board ${boardId}: ${response.status}`
    //   )
    // }

    return FAKE_COMMENTS_DB
  } catch (e) {
    console.error('getComment failed', e)
    throw new Error("Couldn't fetch comments for board")
  }
}

ctx.onmessage = function receive(event) {
  console.log('received message', event.data)
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
              syncBoard({
                id: board.id,
                url: board.sourceUrl,
                file: null,
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

      console.log('files', files)

      response = filesToStackups(files).then(async stackups => {
        const [selfContained, shared] = stackups
        const board = stackupToBoard(selfContained)
        const render = stackupToBoardRender(shared, board)

        ctx.postMessage(boardRendered(render, duration(startTime)))

        syncBoard({
          id: board.id,
          url: null,
          file: Array.isArray(files) ? files[0] : (files as File),
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
      const comment = request.payload

      response = addComment(comment).then(newComment =>
        ctx.postMessage(getCommentEmitter(newComment.boardId))
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
