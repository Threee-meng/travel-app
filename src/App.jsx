import { useCallback, useEffect, useState } from 'react'
import Map from './components/Map'
import CreateTripModal from './components/CreateTripModal'
import TripEdit from './components/TripEdit'
import NotesModal from './components/NotesModal'
import ShareModal from './components/ShareModal'
import './App.css'

const TABS = [
  { id: 'world', name: '世界图鉴' },
  { id: 'trip', name: '我的行程' },
  { id: 'notes', name: '旅行札记' },
]

function normalizeTripCode(value) {
  return String(value ?? '').trim().toUpperCase()
}

function generateTripName(startDate, endDate) {
  if (!startDate || !endDate) return '行程'
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
  return `${days}日游`
}

function createTripRecord(trip) {
  return {
    ...trip,
    id: trip.id ?? Date.now().toString(),
    name: trip.name ?? '',
    startDate: trip.startDate ?? '',
    endDate: trip.endDate ?? '',
    cities: Array.isArray(trip.cities) ? trip.cities : [],
    favorites: Array.isArray(trip.favorites) ? trip.favorites : [],
    days: Array.isArray(trip.days) ? trip.days : [],
    budget: trip.budget ?? '',
    notes: trip.notes ?? '',
    tags: Array.isArray(trip.tags) ? trip.tags : [],
    shareCode: normalizeTripCode(trip.shareCode),
  }
}

function mergeTripIntoCollection(sourceTrips, incomingTrip) {
  const nextTrip = createTripRecord(incomingTrip)
  const existingIndex = sourceTrips.findIndex(
    (trip) =>
      trip.id === nextTrip.id ||
      (
        normalizeTripCode(trip.shareCode) &&
        normalizeTripCode(trip.shareCode) === normalizeTripCode(nextTrip.shareCode)
      ),
  )

  if (existingIndex === -1) {
    return {
      trip: nextTrip,
      trips: sourceTrips,
    }
  }

  const existingTrip = sourceTrips[existingIndex]
  const mergedTrip = {
    ...nextTrip,
    id: existingTrip.id,
  }

  if (JSON.stringify(existingTrip) === JSON.stringify(mergedTrip)) {
    return {
      trip: existingTrip,
      trips: sourceTrips,
    }
  }

  return {
    trip: mergedTrip,
    trips: sourceTrips.map((trip, index) => (index === existingIndex ? mergedTrip : trip)),
  }
}

async function requestTripShareCode(trip) {
  const response = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trip: {
        ...trip,
        shareCode: normalizeTripCode(trip.shareCode) || undefined,
      },
      shareCode: normalizeTripCode(trip.shareCode) || undefined,
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.ok) {
    throw new Error(data.error || '生成行程码失败')
  }

  return normalizeTripCode(data.shareCode)
}

async function fetchTripByShareCode(rawCode, preferredId) {
  const shareCode = normalizeTripCode(rawCode)
  if (!shareCode) {
    throw new Error('请输入行程码')
  }

  const response = await fetch(`/api/share/${shareCode}`)
  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.ok || !data.trip) {
    throw new Error(data.error || '未找到对应行程')
  }

  return createTripRecord({
    ...data.trip,
    id: preferredId || `shared-${data.shareCode || shareCode}`,
    shareCode: data.shareCode || shareCode,
  })
}

function WorldGuide() {
  return <Map mode="world" />
}

function MyTrip({
  trips,
  onCreateTrip,
  onDeleteTrip,
  onUpdateTrip,
  onOpenTrip,
  onShareTrip,
  onGenerateTripCode,
  onSearchTripCode,
}) {
  const [showModal, setShowModal] = useState(false)
  const [editingTrip, setEditingTrip] = useState(null)
  const [tripCodeInput, setTripCodeInput] = useState('')
  const [tripCodeError, setTripCodeError] = useState('')
  const [searchingTripCode, setSearchingTripCode] = useState(false)
  const [searchedTrip, setSearchedTrip] = useState(null)
  const [openingTripId, setOpeningTripId] = useState('')

  const renderTripCard = (trip, options = {}) => {
    const { key, onClick, showDelete = false, showShare = true, highlight = false } = options

    return (
      <div
        key={key ?? trip.id}
        className={`trip-card ${highlight ? 'trip-card-highlight' : ''}`}
        onClick={onClick}
      >
        <div className="trip-card-header">
          <div className="trip-card-header-main">
            <div className="trip-card-title-row">
              <span className="trip-card-title">
                {generateTripName(trip.startDate, trip.endDate)}
              </span>
              <span className={`trip-code-badge ${trip.shareCode ? '' : 'is-empty'}`}>
                行程码 {trip.shareCode || '待生成'}
              </span>
            </div>
            <div className="trip-card-dates">
              {trip.startDate} ~ {trip.endDate}
            </div>
            <div className="trip-card-cities">{trip.cities?.join('、')}</div>
          </div>

          {(showDelete || showShare) && (
            <div className="trip-card-actions">
              {showShare && (
                <button
                  className="trip-card-share"
                  onClick={(event) => {
                    event.stopPropagation()
                    onShareTrip(trip)
                  }}
                  title="分享行程"
                >
                  📤
                </button>
              )}
              {showDelete && (
                <button
                  className="trip-card-delete"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeleteTrip(trips.findIndex((item) => item.id === trip.id))
                  }}
                  title="删除行程"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const handleTripCodeSubmit = async (event) => {
    event.preventDefault()
    setSearchingTripCode(true)

    try {
      const trip = await onSearchTripCode(tripCodeInput)
      setSearchedTrip(trip)
      setTripCodeError('')
    } catch (error) {
      setSearchedTrip(null)
      setTripCodeError(error.message || '请输入有效的行程码')
    } finally {
      setSearchingTripCode(false)
    }
  }

  const handleOpenTrip = async (trip) => {
    setOpeningTripId(trip.id || trip.shareCode || 'opening')

    try {
      const nextTrip = await onOpenTrip(trip)
      setEditingTrip(nextTrip)
    } catch (error) {
      window.alert(error.message || '打开行程失败')
    } finally {
      setOpeningTripId('')
    }
  }

  return (
    <div className="trip-page">
      <div className="trip-left">
        <Map />
      </div>
      <div className="trip-right">
        <button className="create-trip-btn" onClick={() => setShowModal(true)}>
          <span className="create-trip-icon">+</span>
          <span className="create-trip-text">创建行程</span>
        </button>

        <div className="trip-section">
          <h3>我的行程</h3>

          <div className="trip-code-entry">
            <p className="trip-code-tip">输入行程码后，会在下面显示对应行程，点击即可编辑。</p>
            <form className="trip-code-form" onSubmit={handleTripCodeSubmit}>
              <input
                type="text"
                className="trip-code-input"
                placeholder="输入行程码"
                value={tripCodeInput}
                maxLength={8}
                onChange={(event) => {
                  setTripCodeInput(normalizeTripCode(event.target.value))
                  if (tripCodeError) {
                    setTripCodeError('')
                  }
                }}
              />
              <button type="submit" className="trip-code-submit">
                {searchingTripCode ? '搜索中...' : '搜索'}
              </button>
            </form>
            {tripCodeError && <div className="trip-code-error">{tripCodeError}</div>}
          </div>

          <div className="trip-section-list">
            {searchedTrip && (
              <div className="trip-search-result">
                <div className="trip-search-result-title">搜索结果</div>
                {renderTripCard(searchedTrip, {
                  key: `searched-${searchedTrip.shareCode || searchedTrip.id}`,
                  onClick: () => handleOpenTrip(searchedTrip),
                  showDelete: false,
                  showShare: true,
                  highlight: true,
                })}
              </div>
            )}

            {trips.length === 0 ? (
              <div className="trip-section-empty">暂无行程</div>
            ) : (
              trips.map((trip) =>
                renderTripCard(trip, {
                  key: trip.id,
                  onClick: () => handleOpenTrip(trip),
                  showDelete: true,
                  showShare: true,
                }),
              )
            )}
          </div>
          {openingTripId && <div className="trip-opening-tip">正在同步最新行程内容...</div>}
        </div>
      </div>

      {showModal && (
        <CreateTripModal
          onClose={() => setShowModal(false)}
          onGenerateTripCode={onGenerateTripCode}
          onConfirm={async (tripData) => {
            await onCreateTrip(tripData)
            setShowModal(false)
          }}
        />
      )}

      {editingTrip && (
        <TripEdit
          trip={editingTrip}
          onSave={async (updatedTrip) => {
            try {
              await onUpdateTrip(updatedTrip)
              setSearchedTrip((currentTrip) => {
                if (!currentTrip) return currentTrip
                return normalizeTripCode(currentTrip.shareCode) === normalizeTripCode(updatedTrip.shareCode)
                  ? updatedTrip
                  : currentTrip
              })
              setEditingTrip(null)
            } catch (error) {
              window.alert(error.message || '保存行程失败')
            }
          }}
          onClose={() => setEditingTrip(null)}
        />
      )}
    </div>
  )
}

function TravelNotes({ notes, onAddNote, onUpdateNote, onDeleteNote }) {
  const [showModal, setShowModal] = useState(false)
  const [editingNote, setEditingNote] = useState(null)

  return (
    <div className="notes-page">
      <div className="notes-header">
        <h2>旅行札记</h2>
        <button className="create-note-btn" onClick={() => setShowModal(true)}>
          <span className="create-note-icon">+</span>
          <span className="create-note-text">创建笔记</span>
        </button>
      </div>

      <div className="notes-list">
        {notes.length === 0 ? (
          <div className="notes-empty">暂无笔记</div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="note-card">
              <div className="note-card-header">
                <h3 className="note-card-title">{note.title}</h3>
                <button className="note-card-delete" onClick={() => onDeleteNote(note.id)}>
                  ×
                </button>
              </div>
              <div className="note-card-meta">
                <span className="note-card-location">{note.location}</span>
                <span className="note-card-date">{note.date}</span>
              </div>
              <div className="note-card-content">
                {note.content.length > 100 ? `${note.content.substring(0, 100)}...` : note.content}
              </div>
              <button className="note-card-edit" onClick={() => setEditingNote(note)}>
                编辑
              </button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <NotesModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSave={(noteData) => {
            onAddNote(noteData)
            setShowModal(false)
          }}
        />
      )}

      {editingNote && (
        <NotesModal
          open={Boolean(editingNote)}
          onClose={() => setEditingNote(null)}
          note={editingNote}
          onSave={(updatedNote) => {
            onUpdateNote(updatedNote)
            setEditingNote(null)
          }}
        />
      )}
    </div>
  )
}

function loadTrips() {
  try {
    const saved = localStorage.getItem('travel-trips')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function loadNotes() {
  try {
    const saved = localStorage.getItem('travel-notes')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function SharedTripEditor({ shareCode, onBack, onOpenTrip, onUpdateTrip }) {
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!shareCode) return

    onOpenTrip({ id: `shared-${normalizeTripCode(shareCode)}`, shareCode })
      .then((data) => {
        setTrip(data)
      })
      .catch((loadError) => setError(loadError.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [shareCode, onOpenTrip])

  if (loading) return <div className="shared-trip-loading">加载分享行程中...</div>
  if (error) return <div className="shared-trip-error">{error}</div>
  if (!trip) return null

  return (
    <TripEdit
      trip={trip}
      onSave={async (updatedTrip) => {
        await onUpdateTrip(updatedTrip)
        setTrip(createTripRecord(updatedTrip))
      }}
      onClose={onBack}
    />
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('world')
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [sharingTrip, setSharingTrip] = useState(null)
  const [shareCodeFromUrl, setShareCodeFromUrl] = useState(() => {
    const code = new URLSearchParams(window.location.search).get('share')
    return normalizeTripCode(code) || null
  })
  const [initialTrips] = useState(() => loadTrips())
  const [trips, setTrips] = useState(initialTrips)
  const [notes, setNotes] = useState(() => loadNotes())

  useEffect(() => {
    localStorage.setItem('travel-trips', JSON.stringify(trips))
  }, [trips])

  useEffect(() => {
    localStorage.setItem('travel-notes', JSON.stringify(notes))
  }, [notes])

  useEffect(() => {
    let cancelled = false

    async function backfillMissingTripCodes() {
      if (!initialTrips.some((trip) => !normalizeTripCode(trip.shareCode))) {
        return
      }

      const updatedTrips = await Promise.all(
        initialTrips.map(async (trip) => {
          if (normalizeTripCode(trip.shareCode)) {
            return trip
          }

          try {
            const shareCode = await requestTripShareCode(createTripRecord(trip))
            return {
              ...trip,
              shareCode,
            }
          } catch {
            return trip
          }
        }),
      )

      if (!cancelled) {
        const shareCodeMap = new Map(
          updatedTrips
            .filter((trip) => normalizeTripCode(trip.shareCode))
            .map((trip) => [trip.id, normalizeTripCode(trip.shareCode)]),
        )

        setTrips((currentTrips) =>
          currentTrips.map((trip) => {
            const shareCode = shareCodeMap.get(trip.id)
            return shareCode && !normalizeTripCode(trip.shareCode)
              ? { ...trip, shareCode }
              : trip
          }),
        )
      }
    }

    backfillMissingTripCodes()

    return () => {
      cancelled = true
    }
  }, [initialTrips])

  const handleGenerateTripCode = async (tripData) => {
    const draftTrip = createTripRecord({
      id: `draft-${Date.now()}`,
      name: '',
      ...tripData,
    })

    return requestTripShareCode(draftTrip)
  }

  const handleCreateTrip = async (tripData) => {
    const newTrip = createTripRecord({
      id: Date.now().toString(),
      name: '',
      ...tripData,
    })

    try {
      newTrip.shareCode = await requestTripShareCode(newTrip)
    } catch (error) {
      if (!newTrip.shareCode) {
        throw error
      }
    }

    setTrips((prev) => [...prev, newTrip])
  }

  const handleOpenTrip = useCallback(async (trip) => {
    const nextTrip = createTripRecord(trip)
    const shareCode = normalizeTripCode(nextTrip.shareCode)

    if (!shareCode) {
      return nextTrip
    }

    const remoteTrip = await fetchTripByShareCode(shareCode, nextTrip.id)
    const merged = mergeTripIntoCollection(trips, remoteTrip)

    if (merged.trips !== trips) {
      setTrips(merged.trips)
    }

    return merged.trip
  }, [trips])

  const handleUpdateTrip = async (updatedTrip) => {
    const nextTrip = createTripRecord(updatedTrip)

    try {
      nextTrip.shareCode = await requestTripShareCode(nextTrip)
    } catch (error) {
      if (!nextTrip.shareCode) {
        throw error
      }
    }

    setTrips((prev) => {
      const merged = mergeTripIntoCollection(prev, nextTrip)

      if (merged.trips === prev) {
        return [
          ...prev,
          {
            ...merged.trip,
            id: merged.trip.id.startsWith('shared-') ? Date.now().toString() : merged.trip.id,
          },
        ]
      }

      return merged.trips
    })
  }

  const handleDeleteTrip = (index) => {
    setTrips((prev) => prev.filter((_, tripIndex) => tripIndex !== index))
  }

  const handleShareTrip = (trip) => {
    setSharingTrip(trip)
    setShareModalOpen(true)
  }

  const handleSearchTripCode = async (rawCode) => {
    const shareCode = normalizeTripCode(rawCode)
    if (!shareCode) {
      throw new Error('请输入行程码')
    }

    const existingTrip = trips.find((trip) => normalizeTripCode(trip.shareCode) === shareCode)
    return fetchTripByShareCode(shareCode, existingTrip?.id)
  }

  const handleAddNote = (noteData) => {
    const newNote = {
      id: Date.now().toString(),
      ...noteData,
    }
    setNotes((prev) => [...prev, newNote])
  }

  const handleUpdateNote = (updatedNote) => {
    setNotes((prev) => prev.map((note) => (note.id === updatedNote.id ? updatedNote : note)))
  }

  const handleDeleteNote = (noteId) => {
    setNotes((prev) => prev.filter((note) => note.id !== noteId))
  }

  const currentSharingTrip = sharingTrip
    ? trips.find((trip) => trip.id === sharingTrip.id) ?? sharingTrip
    : null

  if (shareCodeFromUrl) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="app-brand">🌶️ 旅行辣椒</div>
          <div className="app-header-auth">
            <button
              type="button"
              className="app-auth-btn secondary"
              onClick={() => {
                setShareCodeFromUrl(null)
                window.history.pushState({}, '', window.location.pathname)
              }}
            >
              返回我的行程
            </button>
          </div>
        </header>
        <main className="app-main">
          <SharedTripEditor
            key={shareCodeFromUrl}
            shareCode={shareCodeFromUrl}
            onBack={() => {
              setShareCodeFromUrl(null)
              window.history.pushState({}, '', window.location.pathname)
            }}
            onOpenTrip={handleOpenTrip}
            onUpdateTrip={handleUpdateTrip}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">🌶️ 旅行辣椒</div>
        <div className="app-header-tabs-wrap">
          <nav className="tab-nav">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'world' && <WorldGuide />}
        {activeTab === 'trip' && (
          <MyTrip
            trips={trips}
            onCreateTrip={handleCreateTrip}
            onDeleteTrip={handleDeleteTrip}
            onUpdateTrip={handleUpdateTrip}
            onOpenTrip={handleOpenTrip}
            onShareTrip={handleShareTrip}
            onGenerateTripCode={handleGenerateTripCode}
            onSearchTripCode={handleSearchTripCode}
          />
        )}
        {activeTab === 'notes' && (
          <TravelNotes
            notes={notes}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
          />
        )}
      </main>

      <ShareModal
        open={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false)
          setSharingTrip(null)
        }}
        trip={currentSharingTrip}
      />
    </div>
  )
}

export default App
